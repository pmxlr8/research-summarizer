import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ok, clientError, serverError, log } from "../lib/http";
import { getJob, setGraph } from "../lib/ddb";
import { extractKnowledgeGraph } from "../lib/bedrock";

/**
 * Returns the knowledge graph for a summary. If the graph hasn't been
 * generated yet, extracts it from the structured summary via Bedrock,
 * persists it, and returns it. Subsequent calls hit the cached copy.
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext?.requestId ?? "unknown";
  const claims = (event.requestContext as { authorizer?: { claims?: { sub?: string } } })?.authorizer?.claims;
  const userId = claims?.sub;
  if (!userId) return clientError(401, "unauthorized", "missing user identity");

  const id = event.pathParameters?.id;
  if (!id) return clientError(400, "invalid_id", "missing id");

  try {
    const job = await getJob(userId, id);
    if (!job) return clientError(404, "not_found", `summary ${id} not found`);
    if (job.status !== "done") {
      return clientError(409, "job_not_ready", `summary is still ${job.status}`);
    }

    const force = event.queryStringParameters?.force === "1";

    if (!force && job.graph && job.graph.nodes && job.graph.nodes.length > 0) {
      log("graph_cached", { requestId, jobId: id, nodes: job.graph.nodes.length });
      return ok({ graph: job.graph, generated: false });
    }

    if (!job.sections || job.sections.length === 0) {
      return clientError(409, "no_sections", "summary has no structured sections to extract from");
    }

    log("graph_generating", { requestId, jobId: id });
    const graph = await extractKnowledgeGraph({
      paperTitle: job.paper.title,
      paperAuthors: job.paper.authors,
      abstract: job.paper.abstract ?? "",
      sections: job.sections,
      keywords: job.keywords ?? [],
    });

    await setGraph({ userId, jobId: id, graph });
    log("graph_generated", { requestId, jobId: id, nodes: graph.nodes.length, edges: graph.edges.length });

    return ok({ graph, generated: true }, { "Cache-Control": "no-store" });
  } catch (err) {
    log("graph_failed", { requestId, message: (err as Error).message });
    return serverError(500, "internal_error", "could not build knowledge graph");
  }
}
