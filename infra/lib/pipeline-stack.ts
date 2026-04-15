import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";

interface PipelineStackProps extends cdk.StackProps {
  table: dynamodb.Table;
  pdfBucket: s3.Bucket;
}

/**
 * Async summarization pipeline.
 *
 * Week 3 scaffold only — the SQS queues and DLQ are defined here.
 * Week 5 adds the Step Functions state machine and the pipeline Lambdas.
 */
export class PipelineStack extends cdk.Stack {
  public readonly jobsQueue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    this.deadLetterQueue = new sqs.Queue(this, "DLQ", {
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    this.jobsQueue = new sqs.Queue(this, "JobsQueue", {
      visibilityTimeout: cdk.Duration.minutes(15),
      retentionPeriod: cdk.Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // TODO (Week 5): Step Functions state machine.
    //   - FetchPDF  Lambda  → writes to props.pdfBucket
    //   - ExtractText Lambda
    //   - Chunk Lambda
    //   - MapSummarize Lambda (parallel) → invokes Bedrock
    //   - ReduceSummary Lambda → writes to props.table

    new cdk.CfnOutput(this, "JobsQueueUrl", { value: this.jobsQueue.queueUrl });
    new cdk.CfnOutput(this, "DLQUrl", { value: this.deadLetterQueue.queueUrl });
  }
}
