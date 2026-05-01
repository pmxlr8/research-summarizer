import { XMLParser } from "fast-xml-parser";
import type { Paper } from "./types";

const ARXIV_ENDPOINT = "https://export.arxiv.org/api/query";
const DEFAULT_TIMEOUT_MS = 12_000;

export class UpstreamError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "UpstreamError";
  }
}

export class UpstreamTimeoutError extends UpstreamError {
  constructor() {
    super("arXiv request timed out");
    this.name = "UpstreamTimeoutError";
  }
}

// Configure parser to keep things predictable: arrays for repeating elements,
// preserve attributes, never auto-coerce strings to numbers (year stays a string
// until WE convert it).
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => ["entry", "author", "link", "category"].includes(name),
});

export type SearchOptions = {
  q: string;
  start?: number;
  maxResults?: number;
  sortBy?: "relevance" | "lastUpdatedDate" | "submittedDate";
  sortOrder?: "ascending" | "descending";
  categories?: string[];
  timeoutMs?: number;
  endpoint?: string;
  fetchImpl?: typeof fetch;   // injectable for tests
};

export async function searchArxiv(opts: SearchOptions): Promise<Paper[]> {
  const url = buildUrl(opts);
  const xml = await httpGet(url, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, opts.fetchImpl ?? fetch);
  return parseAtom(xml);
}

export function buildUrl(opts: SearchOptions): string {
  const endpoint = opts.endpoint ?? ARXIV_ENDPOINT;
  const search = buildSearchQuery(opts.q, opts.categories);
  const params = new URLSearchParams({
    search_query: search,
    start: String(opts.start ?? 0),
    max_results: String(opts.maxResults ?? 10),
    sortBy: opts.sortBy ?? "relevance",
    sortOrder: opts.sortOrder ?? "descending",
  });
  return `${endpoint}?${params.toString()}`;
}

export function buildSearchQuery(q: string, categories?: string[]): string {
  // arXiv treats space as ' ' or '+' (URLSearchParams will encode). Combine
  // category filter with the user's text query.
  const base = `all:${q.trim()}`;
  if (!categories || categories.length === 0) return base;
  const cats = categories.map((c) => `cat:${c}`).join(" OR ");
  return `${base} AND (${cats})`;
}

async function httpGet(url: string, timeoutMs: number, fetchImpl: typeof fetch): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      headers: { "User-Agent": "research-summarizer/1.0 (NYU class project)" },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new UpstreamError(`arXiv returned HTTP ${res.status}`);
    }
    return await res.text();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new UpstreamTimeoutError();
    }
    if (err instanceof UpstreamError) throw err;
    throw new UpstreamError(`arXiv request failed: ${(err as Error).message}`, err);
  } finally {
    clearTimeout(timer);
  }
}

export function parseAtom(xml: string): Paper[] {
  let parsed: any;
  try {
    parsed = parser.parse(xml);
  } catch (e) {
    throw new UpstreamError("failed to parse arXiv response", e);
  }

  const entries = parsed?.feed?.entry;
  if (!entries) return [];   // empty result, valid

  return entries.map(entryToPaper);
}

function entryToPaper(entry: any): Paper {
  // entry.id is "http://arxiv.org/abs/2104.05544v2" — strip prefix, strip version suffix.
  const fullId: string = entry.id ?? "";
  const arxivIdRaw = fullId.split("/").pop() ?? "";
  const arxivId = arxivIdRaw.replace(/v\d+$/, "");

  const authors = (entry.author ?? [])
    .map((a: any) => (typeof a === "string" ? a : a?.name))
    .filter(Boolean) as string[];

  const links = (entry.link ?? []) as Array<{ "@_href"?: string; "@_type"?: string; "@_rel"?: string }>;
  const pdfUrl =
    links.find((l) => l["@_type"] === "application/pdf")?.["@_href"] ??
    `https://arxiv.org/pdf/${arxivId}`;

  const published: string = entry.published ?? "";
  const year = published ? new Date(published).getUTCFullYear() : new Date().getUTCFullYear();

  return {
    id: `arxiv-${arxivId}`,
    title: clean(entry.title ?? ""),
    authors,
    abstract: clean(entry.summary ?? ""),
    year,
    venue: "arXiv",
    arxivId,
    doi: entry["arxiv:doi"] ?? undefined,
    pdfUrl,
  };
}

function clean(text: string): string {
  // arXiv pads titles and abstracts with newlines and double spaces.
  return String(text).replace(/\s+/g, " ").trim();
}