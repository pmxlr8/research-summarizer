import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ok, clientError, serverError, log } from "../lib/http";
import { getUserQuota } from "../lib/ddb";

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext?.requestId ?? "unknown";
  const claims = (event.requestContext as { authorizer?: { claims?: { sub?: string } } })?.authorizer?.claims;
  const userId = claims?.sub;

  if (!userId) return clientError(401, "unauthorized", "missing user identity");

  try {
    const quota = await getUserQuota(userId);
    log("get_quota", { requestId, quota });
    return ok({ quotaRemaining: quota }, { "Cache-Control": "no-store" });
  } catch (err) {
    log("get_quota_failed", { requestId, message: (err as Error).message });
    return serverError(500, "internal_error", "could not fetch quota");
  }
}
