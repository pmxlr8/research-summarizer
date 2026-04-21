import type { Paper, Summary } from "./types";
import { getToken } from "./auth";
import { mockPapers } from "@/data/mock-papers";
import { mockSummaries } from "@/data/mock-summaries";

/**
 * Dual-mode API client.
 *
 * - If NEXT_PUBLIC_API_URL is set → calls real API Gateway with JWT auth.
 * - Otherwise → returns mocks with a simulated network delay.
 *
 * Call sites never change — swap is purely via env vars.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const USE_REAL = !!API_URL;
const MOCK_DELAY = 400;

// ─── Internals ──────────────────────────────────────────────────────

function delay<T>(value: T, ms = MOCK_DELAY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

// ─── Search ─────────────────────────────────────────────────────────

export async function searchPapers(query: string): Promise<Paper[]> {
  if (USE_REAL) {
    return apiFetch<Paper[]>(`search?q=${encodeURIComponent(query)}`);
  }
  const q = query.trim().toLowerCase();
  if (!q) return delay([]);
  return delay(
    mockPapers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.abstract.toLowerCase().includes(q) ||
        p.authors.some((a) => a.toLowerCase().includes(q)),
    ),
  );
}

// ─── Summaries ──────────────────────────────────────────────────────

export async function listSummaries(): Promise<Summary[]> {
  if (USE_REAL) return apiFetch<Summary[]>("summaries");
  return delay(mockSummaries);
}

export async function getSummary(id: string): Promise<Summary | null> {
  if (USE_REAL) {
    try {
      return await apiFetch<Summary>(`summaries/${id}`);
    } catch {
      return null;
    }
  }
  return delay(mockSummaries.find((s) => s.id === id) ?? null);
}

export async function submitSummary(
  paperId: string,
): Promise<{ jobId: string }> {
  if (USE_REAL) {
    return apiFetch<{ jobId: string }>("summarize", {
      method: "POST",
      body: JSON.stringify({ paperId }),
    });
  }
  return delay({ jobId: `job-${Date.now()}-${paperId}` });
}

// ─── Health check (Phase 1 verification) ────────────────────────────

export async function healthCheck(): Promise<{
  status: string;
  userId?: string;
}> {
  if (USE_REAL) return apiFetch("health");
  return delay({ status: "ok (mock)", userId: "mock-user-id" });
}

// ─── Expose mode for debugging ──────────────────────────────────────

export const apiMode: "real" | "mock" = USE_REAL ? "real" : "mock";
