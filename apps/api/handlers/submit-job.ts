import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { v4 as uuidv4 } from "uuid";
import { ok, clientError, serverError, log } from "../lib/http";
import { createJob } from "../lib/ddb";
import type { Paper, PipelinePayload } from "../lib/types";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const JOBS_QUEUE_URL = process.env.JOBS_QUEUE_URL!;

const sqs = new SQSClient({ region: REGION });

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext?.requestId ?? "unknown";
  const userId = extractUserId(event);

  if (!userId) {
    return clientError(401, "unauthorized", "missing user identity");
  }

  let body: { paper?: Paper };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return clientError(400, "invalid_body", "request body is not valid JSON");
  }

  const paper = body.paper;
  if (!paper || !paper.id || !paper.title || !paper.pdfUrl) {
    return clientError(400, "invalid_paper", "request body must include paper.id, paper.title, paper.pdfUrl");
  }

  const jobId = uuidv4();
  const startedAt = new Date().toISOString();

  try {
    await createJob({ jobId, userId, paper });

    const payload: PipelinePayload = { jobId, userId, paper, startedAt };
    await sqs.send(new SendMessageCommand({
      QueueUrl: JOBS_QUEUE_URL,
      MessageBody: JSON.stringify(payload),
    }));

    log("submit_job", { requestId, jobId, paperId: paper.id, userId });
    return ok({ jobId }, { "Cache-Control": "no-store" });
  } catch (err) {
    log("submit_job_failed", { requestId, message: (err as Error).message });
    return serverError(500, "internal_error", "could not submit job");
  }
}

function extractUserId(event: APIGatewayProxyEvent): string | null {
  const claims = (event.requestContext as { authorizer?: { claims?: { sub?: string } } })?.authorizer?.claims;
  return claims?.sub ?? null;
}
