import type { Paper } from "./types";

const SS_ENDPOINT = "https://api.semanticscholar.org/graph/v1/paper/search";
const DEFAULT_TIMEOUT_MS = 8_000;

export class SsError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "SsError";
  }
}

export async function searchSemanticScholar(opts: {
  q: string;
  limit?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<Paper[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const url = `${SS_ENDPOINT}?query=${encodeURIComponent(opts.q)}&limit=${limit}&fields=title,abstract,authors,year,externalIds,openAccessPdf`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let json: unknown;
  try {
    const res = await fetchImpl(url, {
      headers: { "User-Agent": "research-summarizer/1.0 (NYU class project)" },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new SsError(`Semantic Scholar HTTP ${res.status}`);
    }
    json = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const data = (json as { data?: SsItem[] }).data ?? [];
  return data
    .filter((d) => d.title && d.abstract)
    .map(mapToPaper);
}

type SsAuthor = { name?: string };
type SsItem = {
  paperId?: string;
  title?: string;
  abstract?: string;
  authors?: SsAuthor[];
  year?: number;
  externalIds?: { ArXiv?: string; DOI?: string };
  openAccessPdf?: { url?: string };
};

function mapToPaper(item: SsItem): Paper {
  const arxivId = item.externalIds?.ArXiv;
  const doi = item.externalIds?.DOI;
  const id = arxivId
    ? `arxiv-${arxivId}`
    : doi
      ? `doi-${doi}`
      : `ss-${item.paperId ?? Math.random().toString(36).slice(2, 10)}`;

  return {
    id,
    title: (item.title ?? "").trim(),
    authors: (item.authors ?? []).map((a) => a.name ?? "").filter(Boolean),
    abstract: (item.abstract ?? "").trim(),
    year: item.year ?? new Date().getUTCFullYear(),
    venue: "Semantic Scholar",
    arxivId: arxivId,
    doi,
    pdfUrl: item.openAccessPdf?.url
      ?? (arxivId ? `https://arxiv.org/pdf/${arxivId}` : undefined),
  };
}
