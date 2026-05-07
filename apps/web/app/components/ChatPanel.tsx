"use client";

import { useEffect, useRef, useState } from "react";
import { askPaper, ApiError, type ChatCitation } from "@/lib/api";
import { useToast } from "./Toaster";

type Turn = {
  id: number;
  question: string;
  answer?: string;
  citations?: ChatCitation[];
  pending?: boolean;
  error?: string;
};

const SUGGESTED = [
  "What problem does this paper solve?",
  "What are the main results?",
  "What are the limitations?",
  "How does the methodology work?",
];

export function ChatPanel({ jobId }: { jobId: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [openCitations, setOpenCitations] = useState<Record<number, boolean>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();

  // Auto-scroll to the newest turn.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns]);

  async function ask(q: string) {
    if (busy) return;
    const trimmed = q.trim();
    if (trimmed.length < 3) return;
    const id = Date.now();
    setTurns((prev) => [...prev, { id, question: trimmed, pending: true }]);
    setInput("");
    setBusy(true);
    try {
      const res = await askPaper(jobId, trimmed);
      setTurns((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, pending: false, answer: res.answer, citations: res.citations } : t,
        ),
      );
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 409
        ? "The paper is still being summarized. Try again in a moment."
        : (err as Error).message;
      setTurns((prev) =>
        prev.map((t) => (t.id === id ? { ...t, pending: false, error: msg } : t)),
      );
      toast.error(`Chat failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(input);
  }

  function toggleCitations(turnId: number) {
    setOpenCitations((prev) => ({ ...prev, [turnId]: !prev[turnId] }));
  }

  return (
    <section className="mt-12 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500" />
          <h2 className="text-base font-semibold">Talk to this paper</h2>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">RAG via Bedrock</span>
      </header>

      <div ref={scrollRef} className="max-h-[420px] space-y-4 overflow-y-auto px-5 py-4">
        {turns.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Ask any question about this paper. The model will only answer using the paper&apos;s content, with citations.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  disabled={busy}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((t) => (
            <article key={t.id} className="space-y-2">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 px-3.5 py-2 text-sm text-white dark:bg-white dark:text-slate-900">
                  {t.question}
                </p>
              </div>
              <div className="flex">
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2 text-sm text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                  {t.pending ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500 [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500 [animation-delay:240ms]" />
                    </span>
                  ) : t.error ? (
                    <span className="text-red-600 dark:text-red-300">{t.error}</span>
                  ) : (
                    <>
                      <p className="leading-relaxed whitespace-pre-wrap">{t.answer}</p>
                      {t.citations && t.citations.length > 0 ? (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => toggleCitations(t.id)}
                            className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
                          >
                            {openCitations[t.id] ? "Hide" : "Show"} {t.citations.length} source{t.citations.length === 1 ? "" : "s"}
                          </button>
                          {openCitations[t.id] ? (
                            <ul className="mt-2 space-y-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                              {t.citations.map((c) => (
                                <li key={c.index} className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
                                  <span className="mr-1 inline-flex items-center justify-center rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                    [{c.index}]
                                  </span>
                                  <span className="text-[11px] text-slate-400">chunk {c.chunkIndex + 1} · sim {c.score}</span>
                                  <p className="mt-1 italic">{c.snippet}</p>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about this paper…"
          disabled={busy}
          maxLength={1000}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={busy || input.trim().length < 3}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </section>
  );
}
