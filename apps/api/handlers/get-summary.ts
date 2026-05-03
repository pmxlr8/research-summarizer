import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ok, clientError, serverError, log } from "../lib/http";
import { getJob } from "../lib/ddb";

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext?.requestId ?? "unknown";
  const userId = extractUserId(event);

  if (!userId) return clientError(401, "unauthorized", "missing user identity");

  const id = event.pathParameters?.id;
  if (!id) return clientError(400, "invalid_id", "missing id path parameter");

  try {
    const job = await getJob(userId, id);
    if (!job) return clientError(404, "not_found", `summary ${id} not found`);
    log("get_summary", { requestId, jobId: id, status: job.status });
    // Match the frontend's Summary type — sections defaults to [] until done.
    return ok({ ...job, sections: job.sections ?? [] }, { "Cache-Control": "no-store" });
  } catch (err) {
    log("get_summary_failed", { requestId, message: (err as Error).message });
    return serverError(500, "internal_error", "could not fetch summary");
  }
}

function extractUserId(event: APIGatewayProxyEvent): string | null {
  const claims = (event.requestContext as { authorizer?: { claims?: { sub?: string } } })?.authorizer?.claims;
  return claims?.sub ?? null;
}
