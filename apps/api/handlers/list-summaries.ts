import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ok, clientError, serverError, log } from "../lib/http";
import { listJobsForUser } from "../lib/ddb";

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext?.requestId ?? "unknown";
  const userId = extractUserId(event);

  if (!userId) return clientError(401, "unauthorized", "missing user identity");

  try {
    const jobs = await listJobsForUser(userId);
    log("list_summaries", { requestId, count: jobs.length });
    return ok(
      jobs.map((j) => ({ ...j, sections: j.sections ?? [] })),
      { "Cache-Control": "no-store" },
    );
  } catch (err) {
    log("list_summaries_failed", { requestId, message: (err as Error).message });
    return serverError(500, "internal_error", "could not list summaries");
  }
}

function extractUserId(event: APIGatewayProxyEvent): string | null {
  const claims = (event.requestContext as { authorizer?: { claims?: { sub?: string } } })?.authorizer?.claims;
  return claims?.sub ?? null;
}
