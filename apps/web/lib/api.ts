import type { Paper, Summary } from "./types";
import { getToken } from "./auth";
import { mockPapers } from "@/data/mock-papers";
import { mockSummaries } from "@/data/mock-summaries";

/**
 * Dual-mode API client with graceful fallback.
 *
 * - If NEXT_PUBLIC_API_URL is set → tries the real API Gateway first.
 * - If the real call fails (endpoint not deployed yet) → falls back to mocks.
 * - If NEXT_PUBLIC_API_URL is not set → uses mocks directly.
 *
 * This means mock data shows until the actual Lambda handlers are deployed.
 * No frontend code changes needed when backend endpoints come online.
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
  const q = query.trim().toLowerCase();
  if (!q) return delay([]);

  if (USE_REAL) {
    try {
      return await apiFetch<Paper[]>(`search?q=${encodeURIComponent(query)}`);
    } catch {
      // endpoint not deployed yet — fall back to mocks
    }
  }
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
  if (USE_REAL) {
    try {
      return await apiFetch<Summary[]>("summaries");
    } catch {
      // endpoint not deployed yet — fall back to mocks
    }
  }
  return delay(mockSummaries);
}

export async function getSummary(id: string): Promise<Summary | null> {
  if (USE_REAL) {
    try {
      return await apiFetch<Summary>(`summaries/${id}`);
    } catch {
      // fall back to mocks
    }
  }
  return delay(mockSummaries.find((s) => s.id === id) ?? null);
}

export async function submitSummary(
  paper: Paper,
): Promise<{ jobId: string }> {
  if (USE_REAL) {
    // Real backend needs the full paper object (pdfUrl, title, etc.) to
    // start the pipeline. Don't catch errors — let the UI handle them so
    // we don't silently fall back to a fake job id.
    return apiFetch<{ jobId: string }>("summarize", {
      method: "POST",
      body: JSON.stringify({ paper }),
    });
  }
  return delay({ jobId: `mock-${Date.now()}-${paper.id}` });
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
