import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { searchArxiv, UpstreamError, UpstreamTimeoutError } from "../lib/arxiv";
import { ok, clientError, serverError, log } from "../lib/http";

const DEFAULT_MAX_RESULTS = 10;
const MAX_RESULTS_LIMIT = 50;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext?.requestId ?? "unknown";

  try {
    const params = parseParams(event);

    log("search_request", { requestId, ...params });

    const papers = await searchArxiv({
      q: params.q,
      start: params.start,
      maxResults: params.maxResults,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      categories: params.categories,
    });

    log("search_success", { requestId, count: papers.length });
    return ok(papers);
  } catch (err) {
    if (err instanceof InvalidQueryError) {
      log("search_invalid", { requestId, message: err.message });
      return clientError(400, "invalid_query", err.message);
    }
    if (err instanceof UpstreamTimeoutError) {
      log("search_upstream_timeout", { requestId });
      return serverError(504, "upstream_timeout", "arXiv took too long to respond");
    }
    if (err instanceof UpstreamError) {
      log("search_upstream_error", { requestId, message: err.message });
      return serverError(502, "upstream_error", err.message);
    }
    log("search_unhandled", { requestId, message: (err as Error).message });
    return serverError(500, "internal_error", "unexpected error");
  }
}

class InvalidQueryError extends Error {}

type ParsedParams = {
  q: string;
  start: number;
  maxResults: number;
  sortBy: "relevance" | "lastUpdatedDate" | "submittedDate";
  sortOrder: "ascending" | "descending";
  categories?: string[];
};

function parseParams(event: APIGatewayProxyEvent): ParsedParams {
  const qs = event.queryStringParameters ?? {};

  const q = (qs.q ?? "").trim();
  if (!q) throw new InvalidQueryError("'q' is required and must be non-empty");
  if (q.length > 200) throw new InvalidQueryError("'q' must be <= 200 characters");

  const maxResults = parseIntParam(qs.max_results, DEFAULT_MAX_RESULTS, "max_results");
  if (maxResults < 1 || maxResults > MAX_RESULTS_LIMIT) {
    throw new InvalidQueryError(`max_results must be between 1 and ${MAX_RESULTS_LIMIT}`);
  }

  const start = parseIntParam(qs.start, 0, "start");
  if (start < 0 || start > 1000) {
    throw new InvalidQueryError("start must be between 0 and 1000");
  }

  const sortBy = (qs.sort_by ?? "relevance") as ParsedParams["sortBy"];
  if (!["relevance", "lastUpdatedDate", "submittedDate"].includes(sortBy)) {
    throw new InvalidQueryError(`invalid sort_by: ${sortBy}`);
  }

  const sortOrder = (qs.sort_order ?? "descending") as ParsedParams["sortOrder"];
  if (!["ascending", "descending"].includes(sortOrder)) {
    throw new InvalidQueryError(`invalid sort_order: ${sortOrder}`);
  }

  const categories = qs.categories
    ? qs.categories.split(",").map((c) => c.trim()).filter(Boolean)
    : undefined;

  return { q, start, maxResults, sortBy, sortOrder, categories };
}

function parseIntParam(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new InvalidQueryError(`${name} must be an integer`);
  return n;
}