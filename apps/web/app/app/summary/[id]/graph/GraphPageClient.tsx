"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getGraph, getSummary, ApiError } from "@/lib/api";
import { KnowledgeGraphView } from "@/app/components/KnowledgeGraphView";
import type { KnowledgeGraph, Summary } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "generating" }
  | { kind: "ready"; graph: KnowledgeGraph; generated: boolean }
  | { kind: "missing" }
  | { kind: "error"; message: string };

export default function GraphPageClient({ id }: { id: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [effectiveId, setEffectiveId] = useState<string>(id);

  useEffect(() => {
    const segments = window.location.pathname.split("/").filter(Boolean);
    const realId = segments[segments.length - 2];
    const next = realId && realId !== "_view" ? realId : id;
    setEffectiveId(next);
  }, [id]);

  useEffect(() => {
    if (!effectiveId) return;
    let cancelled = false;
    (async () => {
      try {
        const sum = await getSummary(effectiveId);
        if (cancelled) return;
        setSummary(sum);
        if (!sum) {
          setState({ kind: "missing" });
          return;
        }
        setState((s) => (s.kind === "loading" ? { kind: "generating" } : s));
        const { graph, generated } = await getGraph(effectiveId);
        if (cancelled) return;
        setState({ kind: "ready", graph, generated });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : (err as Error).message;
        setState({ kind: "error", message });
      }
    })();
    return () => { cancelled = true; };
  }, [effectiveId]);

  async function regenerate() {
    setState({ kind: "generating" });
    try {
      const { graph, generated } = await getGraph(effectiveId, { force: true });
      setState({ kind: "ready", graph, generated });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : (err as Error).message;
      setState({ kind: "error", message });
    }
  }

  return (
    <div className="mx-auto max-w-[110rem] px-4 py-6 lg:px-8">
      <nav className="text-sm text-slate-500 dark:text-slate-400">
        <Link href="/app" className="hover:text-slate-700 dark:hover:text-slate-200">Dashboard</Link>
        <span className="mx-2">/</span>
        {summary ? (
          <Link
            href={`/app/summary/${summary.id}`}
            className="hover:text-slate-700 dark:hover:text-slate-200"
          >
            Summary
          </Link>
        ) : (
          <span>Summary</span>
        )}
        <span className="mx-2">/</span>
        <span className="text-slate-700 dark:text-slate-200">Graph</span>
      </nav>

      <header className="mt-4 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {summary?.paper.title ?? "Knowledge graph"}
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            knowledge graph
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {state.kind === "ready" ? (
            <button
              type="button"
              onClick={regenerate}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-cyan-500 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-400 dark:hover:text-cyan-300"
              title="Re-extract entities with a fresh LLM call"
            >
              ↻ Regenerate
            </button>
          ) : null}
          {summary ? (
            <Link
              href={`/app/summary/${summary.id}`}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-cyan-500 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-400 dark:hover:text-cyan-300"
            >
              ← back to summary
            </Link>
          ) : null}
        </div>
      </header>

      <div className="mt-6">
        {state.kind === "loading" || state.kind === "generating" ? (
          <div className="flex h-[640px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <span className="relative inline-block h-3 w-3">
              <span className="absolute inset-0 animate-ping rounded-full bg-gradient-to-br from-cyan-400 via-indigo-500 to-violet-500 opacity-60" />
              <span className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 via-indigo-500 to-violet-500" />
            </span>
            <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">
              {state.kind === "generating" ? "Building the knowledge graph" : "Loading"}
            </p>
            <p className="mt-1 max-w-sm text-center text-xs text-slate-500 dark:text-slate-400">
              {state.kind === "generating"
                ? "First time on this paper — extracting entities and relationships from the structured summary. ~10 seconds."
                : "Just a moment."}
            </p>
          </div>
        ) : state.kind === "missing" ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-sm font-semibold">Summary not found</h3>
          </div>
        ) : state.kind === "error" ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-12 text-center dark:border-red-900 dark:bg-red-950/40">
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">Could not build graph</h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">{state.message}</p>
          </div>
        ) : (
          <>
            <KnowledgeGraphView graph={state.graph} />
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              {state.graph.nodes.length} entities · {state.graph.edges.length} relationships
              {state.generated ? " · just generated" : " · cached"}
              · click any node for details, drag to reposition, scroll to zoom
            </p>
          </>
        )}
      </div>
    </div>
  );
}
