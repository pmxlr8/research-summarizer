import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";

interface PipelineStackProps extends cdk.StackProps {
  table: dynamodb.Table;
  pdfBucket: s3.Bucket;
}

// Default to Qwen 3 Next 80B because Anthropic models on this account
// require submitting the use-case-details form first. Once that's done,
// swap to "us.anthropic.claude-sonnet-4-5-20250929-v1:0" — the bedrock.ts
// helper auto-detects which API format to use based on the model ID.
const BEDROCK_MODEL_ID = "qwen.qwen3-next-80b-a3b";

/**
 * Async summarization pipeline.
 *
 * Topology:
 *   SQS Jobs Queue → Trigger Lambda → Step Functions state machine
 *
 * State machine:
 *   FetchPDF → ExtractText → Chunk → MapSummarize (parallel) → ReduceSummary
 *
 * On any failure (after exhausting retries) the job's DynamoDB record is
 * flipped to "failed" with the error cause.
 */
export class PipelineStack extends cdk.Stack {
  public readonly jobsQueue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    // ─── Queues ────────────────────────────────────────────────────

    this.deadLetterQueue = new sqs.Queue(this, "DLQ", {
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    this.jobsQueue = new sqs.Queue(this, "JobsQueue", {
      visibilityTimeout: cdk.Duration.minutes(15),
      retentionPeriod: cdk.Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: { queue: this.deadLetterQueue, maxReceiveCount: 3 },
    });

    // ─── Pipeline Lambdas ──────────────────────────────────────────

    const apiRoot = path.join(__dirname, "..", "..", "apps", "api");
    const handlersRoot = path.join(apiRoot, "handlers", "pipeline");
    const lockfile = path.join(apiRoot, "package-lock.json");

    const baseProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      projectRoot: apiRoot,
      depsLockFilePath: lockfile,
      handler: "handler",
      bundling: {
        externalModules: ["@aws-sdk/*"],
        minify: true,
      },
      environment: {
        TABLE_NAME: props.table.tableName,
        PDF_BUCKET: props.pdfBucket.bucketName,
        BEDROCK_MODEL_ID,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    } satisfies Partial<nodejs.NodejsFunctionProps>;

    const fetchPdfFn = new nodejs.NodejsFunction(this, "FetchPdfFn", {
      ...baseProps,
      entry: path.join(handlersRoot, "fetch-pdf.ts"),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
    });

    const extractTextFn = new nodejs.NodejsFunction(this, "ExtractTextFn", {
      ...baseProps,
      entry: path.join(handlersRoot, "extract-text.ts"),
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      bundling: {
        ...baseProps.bundling,
        // pdf-parse imports test fixtures via fs at module init; ship the lib
        // unbundled so its require paths resolve correctly at runtime.
        nodeModules: ["pdf-parse"],
      },
    });

    const chunkFn = new nodejs.NodejsFunction(this, "ChunkFn", {
      ...baseProps,
      entry: path.join(handlersRoot, "chunk.ts"),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    const mapSummarizeFn = new nodejs.NodejsFunction(this, "MapSummarizeFn", {
      ...baseProps,
      entry: path.join(handlersRoot, "map-summarize.ts"),
      timeout: cdk.Duration.seconds(120),
      memorySize: 512,
    });

    const reduceSummaryFn = new nodejs.NodejsFunction(this, "ReduceSummaryFn", {
      ...baseProps,
      entry: path.join(handlersRoot, "reduce-summary.ts"),
      timeout: cdk.Duration.seconds(120),
      memorySize: 512,
    });

    // ─── IAM grants ────────────────────────────────────────────────

    [fetchPdfFn, extractTextFn, chunkFn, mapSummarizeFn].forEach((fn) =>
      props.pdfBucket.grantReadWrite(fn),
    );

    props.table.grantReadWriteData(fetchPdfFn);
    props.table.grantReadWriteData(reduceSummaryFn);

    const bedrockPolicy = new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel"],
      resources: [
        `arn:aws:bedrock:*::foundation-model/*`,
        `arn:aws:bedrock:*:*:inference-profile/*`,
      ],
    });
    mapSummarizeFn.addToRolePolicy(bedrockPolicy);
    reduceSummaryFn.addToRolePolicy(bedrockPolicy);

    // ─── Step Functions state machine ──────────────────────────────

    const fetchTask = new tasks.LambdaInvoke(this, "FetchPDF", {
      lambdaFunction: fetchPdfFn,
      payloadResponseOnly: true,
      retryOnServiceExceptions: true,
    }).addRetry({ maxAttempts: 2, interval: cdk.Duration.seconds(5), backoffRate: 2 });

    const extractTask = new tasks.LambdaInvoke(this, "ExtractText", {
      lambdaFunction: extractTextFn,
      payloadResponseOnly: true,
      retryOnServiceExceptions: true,
    }).addRetry({ maxAttempts: 1 });

    const chunkTask = new tasks.LambdaInvoke(this, "Chunk", {
      lambdaFunction: chunkFn,
      payloadResponseOnly: true,
      retryOnServiceExceptions: true,
    });

    const mapTask = new tasks.LambdaInvoke(this, "MapInvoke", {
      lambdaFunction: mapSummarizeFn,
      payloadResponseOnly: true,
      retryOnServiceExceptions: true,
    }).addRetry({ maxAttempts: 3, interval: cdk.Duration.seconds(5), backoffRate: 2 });

    const mapState = new sfn.Map(this, "MapSummarize", {
      maxConcurrency: 5,
      itemsPath: sfn.JsonPath.stringAt("$.chunkKeys"),
      itemSelector: {
        "jobId.$": "$.jobId",
        "chunkKey.$": "$$.Map.Item.Value",
      },
      resultPath: "$.chunkSummaries",
    }).itemProcessor(mapTask);

    const reduceTask = new tasks.LambdaInvoke(this, "ReduceSummary", {
      lambdaFunction: reduceSummaryFn,
      payloadResponseOnly: true,
      retryOnServiceExceptions: true,
      payload: sfn.TaskInput.fromObject({
        "jobId.$": "$.jobId",
        "userId.$": "$.userId",
        "startedAt.$": "$.startedAt",
        "chunkSummaries.$": "$.chunkSummaries",
      }),
    }).addRetry({ maxAttempts: 2, interval: cdk.Duration.seconds(5) });

    // Failure handler: marks the job as failed with the error message.
    const markFailed = new tasks.CallAwsService(this, "MarkFailed", {
      service: "dynamodb",
      action: "updateItem",
      iamResources: [props.table.tableArn],
      parameters: {
        TableName: props.table.tableName,
        Key: {
          PK: { "S.$": "States.Format('USER#{}', $.userId)" },
          SK: { "S.$": "States.Format('JOB#{}', $.jobId)" },
        },
        UpdateExpression: "SET #s = :s, #e = :e",
        ExpressionAttributeNames: { "#s": "status", "#e": "error" },
        ExpressionAttributeValues: {
          ":s": { S: "failed" },
          ":e": { "S.$": "$.errorInfo.Cause" },
        },
      },
      resultPath: sfn.JsonPath.DISCARD,
    });

    const definition = fetchTask
      .next(extractTask)
      .next(chunkTask)
      .next(mapState)
      .next(reduceTask);

    [fetchTask, extractTask, chunkTask, mapState, reduceTask].forEach((s) =>
      s.addCatch(markFailed, { resultPath: "$.errorInfo" }),
    );

    this.stateMachine = new sfn.StateMachine(this, "SummarizationStateMachine", {
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.minutes(10),
      logs: {
        destination: new logs.LogGroup(this, "StateMachineLogs", {
          retention: logs.RetentionDays.ONE_WEEK,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
        level: sfn.LogLevel.ERROR,
      },
    });

    // ─── SQS → Step Functions trigger ──────────────────────────────

    const triggerFn = new nodejs.NodejsFunction(this, "TriggerFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      projectRoot: apiRoot,
      depsLockFilePath: lockfile,
      entry: path.join(apiRoot, "handlers", "pipeline", "trigger.ts"),
      handler: "handler",
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      bundling: { externalModules: ["@aws-sdk/*"], minify: true },
      environment: { STATE_MACHINE_ARN: this.stateMachine.stateMachineArn },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    this.stateMachine.grantStartExecution(triggerFn);

    triggerFn.addEventSource(
      new lambdaEventSources.SqsEventSource(this.jobsQueue, {
        batchSize: 1,
        reportBatchItemFailures: true,
      }),
    );

    // ─── Outputs ───────────────────────────────────────────────────

    new cdk.CfnOutput(this, "JobsQueueUrl", { value: this.jobsQueue.queueUrl });
    new cdk.CfnOutput(this, "DLQUrl", { value: this.deadLetterQueue.queueUrl });
    new cdk.CfnOutput(this, "StateMachineArn", { value: this.stateMachine.stateMachineArn });
  }
}
