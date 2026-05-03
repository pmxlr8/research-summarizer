import type { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from "aws-lambda";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { log } from "../../lib/http";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN!;

const sfn = new SFNClient({ region: REGION });

/**
 * SQS event source — one execution per message.
 * Reports per-record failures so SQS can redrive only what failed.
 */
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const failures: SQSBatchItemFailure[] = [];

  await Promise.all(event.Records.map(async (record) => {
    try {
      const payload = JSON.parse(record.body);
      await sfn.send(new StartExecutionCommand({
        stateMachineArn: STATE_MACHINE_ARN,
        input: record.body,
        // Use the SQS message id so we don't double-trigger if the message
        // redrives. Step Functions will reject duplicate execution names.
        name: `${payload.jobId}-${record.messageId.slice(0, 8)}`,
      }));
      log("trigger_started", { jobId: payload.jobId, messageId: record.messageId });
    } catch (err) {
      log("trigger_failed", { messageId: record.messageId, message: (err as Error).message });
      failures.push({ itemIdentifier: record.messageId });
    }
  }));

  return { batchItemFailures: failures };
}
