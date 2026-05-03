import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSearchQuery, buildUrl, parseAtom, searchArxiv, UpstreamError } from "../lib/arxiv";

const fixture = readFileSync(join(__dirname, "fixtures/arxiv-transformer.xml"), "utf-8");

describe("buildSearchQuery", () => {
  it("uses all: for single-word queries", () => {
    expect(buildSearchQuery("transformer")).toBe("all:transformer");
  });

  it("phrase-quotes multi-word queries with title boost", () => {
    expect(buildSearchQuery("transformer healthcare")).toBe(
      `(ti:"transformer healthcare" OR all:"transformer healthcare")`
    );
  });

  it("appends category filter when provided", () => {
    expect(buildSearchQuery("attention", ["cs.CL", "cs.LG"])).toBe(
      "all:attention AND (cat:cs.CL OR cat:cs.LG)"
    );
  });
});

describe("buildUrl", () => {
  it("constructs a valid arXiv URL", () => {
    const url = buildUrl({ q: "transformer", start: 0, maxResults: 5 });
    expect(url).toContain("export.arxiv.org/api/query");
    expect(url).toContain("search_query=all%3Atransformer");
    expect(url).toContain("max_results=5");
  });
});

describe("parseAtom", () => {
  it("parses a real arXiv response into Paper[]", () => {
    const papers = parseAtom(fixture);
    expect(papers.length).toBeGreaterThan(0);
    const p = papers[0];
    expect(p.id).toMatch(/^arxiv-/);
    expect(p.title).toBeTruthy();
    expect(p.title).not.toContain("\n");        // cleaned
    expect(p.abstract).toBeTruthy();
    expect(p.abstract).not.toContain("  ");     // cleaned
    expect(typeof p.year).toBe("number");
    expect(p.year).toBeGreaterThan(1990);
    expect(Array.isArray(p.authors)).toBe(true);
    expect(p.authors.length).toBeGreaterThan(0);
    expect(p.pdfUrl).toMatch(/^https?:\/\//);
    expect(p.venue).toBe("arXiv");
    expect(p.arxivId).toMatch(/^\d/);
  });

  it("returns [] on a feed with no entries", () => {
    const empty = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><totalResults>0</totalResults></feed>';
    expect(parseAtom(empty)).toEqual([]);
  });
});

describe("searchArxiv (with injected fetch)", () => {
  it("happy path", async () => {
    const fakeFetch = (async () =>
      new Response(fixture, { status: 200 })) as typeof fetch;
    const papers = await searchArxiv({ q: "transformer", maxResults: 2, fetchImpl: fakeFetch });
    expect(papers.length).toBeGreaterThan(0);
  });

  it("HTTP 503 → UpstreamError", async () => {
    const fakeFetch = (async () =>
      new Response("upstream down", { status: 503 })) as typeof fetch;
    await expect(searchArxiv({ q: "x", fetchImpl: fakeFetch })).rejects.toBeInstanceOf(UpstreamError);
  });
});