import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { searchArxiv, UpstreamError, UpstreamTimeoutError } from "../lib/arxiv";
import { searchSemanticScholar } from "../lib/semantic-scholar";
import { ok, clientError, serverError, log } from "../lib/http";
import type { Paper } from "../lib/types";

const DEFAULT_MAX_RESULTS = 10;
const MAX_RESULTS_LIMIT = 50;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext?.requestId ?? "unknown";

  try {
    const params = parseParams(event);

    log("search_request", { requestId, ...params });

    // Hit arXiv and Semantic Scholar in parallel. We tolerate either one
    // failing — but if both fail with upstream errors we surface that.
    const [arxivResult, ssResult] = await Promise.allSettled([
      searchArxiv({
        q: params.q,
        start: params.start,
        maxResults: params.maxResults,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        categories: params.categories,
      }),
      searchSemanticScholar({ q: params.q, limit: params.maxResults }),
    ]);

    const arxiv = arxivResult.status === "fulfilled" ? arxivResult.value : [];
    const ss = ssResult.status === "fulfilled" ? ssResult.value : [];

    if (arxivResult.status === "rejected" && ssResult.status === "rejected") {
      // Both upstreams failed — surface the arXiv error since that's the
      // primary source.
      throw arxivResult.reason;
    }

    const papers = mergeByIdentity(arxiv, ss).slice(0, params.maxResults);

    log("search_success", {
      requestId,
      count: papers.length,
      arxiv: arxiv.length,
      semanticScholar: ss.length,
      arxivOk: arxivResult.status === "fulfilled",
      ssOk: ssResult.status === "fulfilled",
    });
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

/**
 * Merge two paper lists, prefer arXiv entries when both sources have the
 * same identity (matched on arxivId, then DOI, then normalized title).
 * Preserves arXiv ordering as the primary feed.
 */
function mergeByIdentity(primary: Paper[], secondary: Paper[]): Paper[] {
  const out = [...primary];
  const seen = new Set<string>();
  for (const p of primary) {
    if (p.arxivId) seen.add(`arxiv:${p.arxivId}`);
    if (p.doi) seen.add(`doi:${p.doi.toLowerCase()}`);
    seen.add(`title:${normalizeTitle(p.title)}`);
  }
  for (const p of secondary) {
    const keys = [
      p.arxivId ? `arxiv:${p.arxivId}` : null,
      p.doi ? `doi:${p.doi.toLowerCase()}` : null,
      `title:${normalizeTitle(p.title)}`,
    ].filter(Boolean) as string[];
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    out.push(p);
  }
  return out;
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}