import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";

interface FrontendStackProps extends cdk.StackProps {
  apiEndpoint: string;
  userPoolId: string;
  userPoolClientId: string;
}

/**
 * Static frontend distribution.
 *
 *   - Private S3 bucket (no public access).
 *   - CloudFront distribution in front of it using Origin Access Identity.
 *   - SPA fallback: 403/404 → 200 /index.html so client-side routing works.
 *
 * The bucket is empty at first — Phase 1 adds a deploy step that uploads
 * the Next.js static export. We don't wire it here to keep the initial
 * deploy cheap and easy.
 */
export class FrontendStack extends cdk.Stack {
  public readonly siteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    this.siteBucket = new s3.Bucket(this, "SiteBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: "index.html",
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US/EU only — free-tier friendly
    });

    new cdk.CfnOutput(this, "SiteBucketName", { value: this.siteBucket.bucketName });
    new cdk.CfnOutput(this, "DistributionDomain", {
      value: this.distribution.domainName,
    });
    new cdk.CfnOutput(this, "ApiEndpoint", { value: props.apiEndpoint });
    new cdk.CfnOutput(this, "UserPoolId", { value: props.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: props.userPoolClientId });
  }
}
