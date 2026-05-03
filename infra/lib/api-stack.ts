import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";

interface ApiStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  table: dynamodb.Table;
  jobsQueue: sqs.Queue;
}

/**
 * Public REST API.
 *
 * Phase 1 scope (walking skeleton):
 *   GET /health  →  healthFn  (stub, returns { status: "ok", userId })
 *
 * Phase 2+ adds /search, /summarize, /summaries/{jobId} handlers.
 *
 * Authentication: every route is protected by a Cognito JWT authorizer
 * configured on the API Gateway. Our Lambdas never see unauthenticated
 * traffic.
 */
export class ApiStack extends cdk.Stack {
  public readonly apiEndpoint: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Phase 1 stub — returns the authenticated user's id so we can verify
    // the auth flow end-to-end before implementing real handlers.
    const healthFn = new lambda.Function(this, "HealthFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      timeout: cdk.Duration.seconds(5),
      memorySize: 256,
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          const claims = event?.requestContext?.authorizer?.claims ?? {};
          return {
            statusCode: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
              status: "ok",
              userId: claims.sub ?? null,
              email: claims.email ?? null,
              now: new Date().toISOString(),
            }),
          };
        };
      `),
      environment: {
        TABLE_NAME: props.table.tableName,
        JOBS_QUEUE_URL: props.jobsQueue.queueUrl,
      },
    });

    const api = new apigw.RestApi(this, "Api", {
      restApiName: "research-summarizer-api",
      deployOptions: {
        stageName: "v1",
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, "JwtAuthorizer", {
      cognitoUserPools: [props.userPool],
    });

    const authProps: apigw.MethodOptions = {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    };

    api.root
      .addResource("health")
      .addMethod("GET", new apigw.LambdaIntegration(healthFn), authProps);

    // Phase 2: search handler — calls arXiv API, returns Paper[]
    const apiRoot = path.join(__dirname, "..", "..", "apps", "api");
    const searchFn = new nodejs.NodejsFunction(this, "SearchFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(apiRoot, "handlers", "search.ts"),
      handler: "handler",
      projectRoot: apiRoot,
      depsLockFilePath: path.join(apiRoot, "package-lock.json"),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      bundling: {
        // fast-xml-parser is the only runtime dep; bundle it.
        externalModules: ["@aws-sdk/*"],
        minify: true,
      },
    });

    api.root
      .addResource("search")
      .addMethod("GET", new apigw.LambdaIntegration(searchFn), authProps);

    this.apiEndpoint = api.url;
    new cdk.CfnOutput(this, "ApiEndpoint", { value: api.url });
  }
}
