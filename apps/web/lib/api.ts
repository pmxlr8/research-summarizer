import type { Paper, Summary } from "./types";
import { mockPapers } from "@/data/mock-papers";
import { mockSummaries } from "@/data/mock-summaries";

/**
 * API client — currently returns mocks. Phase 2+ will wire this up to the
 * real API Gateway endpoints without changing the call sites.
 */

const NETWORK_DELAY = 400; // ms — feels like a real network call

function delay<T>(value: T, ms = NETWORK_DELAY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function searchPapers(query: string): Promise<Paper[]> {
  const q = query.trim().toLowerCase();
  if (!q) return delay([]);
  const matches = mockPapers.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.abstract.toLowerCase().includes(q) ||
      p.authors.some((a) => a.toLowerCase().includes(q)),
  );
  return delay(matches);
}

export async function listSummaries(): Promise<Summary[]> {
  return delay(mockSummaries);
}

export async function getSummary(id: string): Promise<Summary | null> {
  const found = mockSummaries.find((s) => s.id === id);
  return delay(found ?? null);
}

export async function submitSummary(paperId: string): Promise<{ jobId: string }> {
  // In the real API this returns 202 Accepted with a jobId; the pipeline
  // processes asynchronously and the frontend polls getSummary.
  return delay({ jobId: `job-${Date.now()}-${paperId}` });
}
