"use client";

const KEY = "rs.searches";
const MAX = 8;

export function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function addSearch(q: string): void {
  if (typeof window === "undefined") return;
  const trimmed = q.trim();
  if (!trimmed) return;
  const current = getSearchHistory();
  const next = [trimmed, ...current.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    // Notify same-tab listeners (storage event only fires in other tabs).
    window.dispatchEvent(new CustomEvent("rs:search-history-changed"));
  } catch {
    // ignore quota errors
  }
}

export function clearSearchHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("rs:search-history-changed"));
}
