"use client";

import { useEffect, useRef, useState } from "react";
import { askPaper, ApiError, type ChatCitation } from "@/lib/api";
import { useToast } from "./Toaster";
import { CitationText } from "./CitationText";

type Turn = {
  id: number;
  question: string;
  answer?: string;
  citations?: ChatCitation[];
  pending?: boolean;
  error?: string;
};

const STARTERS = [
  "What problem is this paper solving?",
  "Summarize the methodology in plain language",
  "What are the limitations the authors acknowledge?",
];

export function ChatPanel({ jobId }: { jobId: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastTurnRef = useRef<HTMLLIElement | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (lastTurnRef.current) {
      lastTurnRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [turns.length]);

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
        ? "The summary isn't ready yet — try again in a moment."
        : (err as Error).message;
      setTurns((prev) =>
        prev.map((t) => (t.id === id ? { ...t, pending: false, error: msg } : t)),
      );
      toast.error(msg);
    } finally {
      setBusy(false);
      // Refocus the input so the user can chain questions.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(input);
  }

  return (
    <section className="mt-16 border-t border-slate-200 pt-10 dark:border-slate-800">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Questions
        </h2>
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          grounded in the paper
        </span>
      </div>

      {turns.length === 0 ? (
        <div className="mt-6">
          <p className="max-w-2xl text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
            Ask anything about the paper&apos;s content. Each answer is restricted to the
            paper&apos;s own text and cites the specific chunks it draws from.
          </p>
          <ul className="mt-5 space-y-1.5">
            {STARTERS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => ask(s)}
                  disabled={busy}
                  className="group flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left text-[14px] text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-900"
                >
                  <span className="text-slate-400 transition group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-200">→</span>
                  <span className="flex-1">{s}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ol className="mt-8 space-y-10">
          {turns.map((t, i) => (
            <li
              key={t.id}
              ref={i === turns.length - 1 ? lastTurnRef : null}
              className="relative pl-6"
            >
              <span
                aria-hidden
                className="absolute left-0 top-1.5 inline-block h-full w-px bg-gradient-to-b from-cyan-400/70 via-indigo-500/40 to-violet-500/0"
              />

              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Q{String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">
                  {t.question}
                </h3>
              </div>

              <div className="mt-3 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                {t.pending ? (
                  <span className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <span className="relative inline-block h-2 w-2">
                      <span className="absolute inset-0 animate-ping rounded-full bg-gradient-to-br from-cyan-400 via-indigo-500 to-violet-500 opacity-60" />
                      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 via-indigo-500 to-violet-500" />
                    </span>
                    <span className="italic">reading the paper</span>
                  </span>
                ) : t.error ? (
                  <span className="text-red-600 dark:text-red-400">{t.error}</span>
                ) : (
                  <CitationText text={t.answer ?? ""} citations={t.citations} />
                )}
              </div>

              {t.citations && t.citations.length > 0 ? (
                <details className="group mt-4">
                  <summary className="cursor-pointer list-none text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 transition hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200">
                    <span className="mr-1.5 inline-block transition group-open:rotate-90">›</span>
                    {t.citations.length} source{t.citations.length === 1 ? "" : "s"}
                  </summary>
                  <ol className="mt-3 space-y-3 border-l border-slate-200 pl-4 dark:border-slate-800">
                    {t.citations.map((c) => (
                      <li key={c.index} className="text-[13px] leading-relaxed">
                        <div className="flex items-baseline gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          <span className="font-semibold">[{c.index}]</span>
                          <span>chunk {c.chunkIndex + 1}</span>
                          <span className="text-slate-400 dark:text-slate-600">·</span>
                          <span>cosine {c.score.toFixed(2)}</span>
                        </div>
                        <p className="mt-1 text-slate-600 dark:text-slate-400">{c.snippet}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-10 flex items-center gap-3 border-t border-slate-200 pt-5 dark:border-slate-800"
      >
        <span className="select-none font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          ask
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={turns.length === 0 ? "What does this paper actually contribute?" : "follow-up question"}
          disabled={busy}
          maxLength={1000}
          className="flex-1 border-0 bg-transparent py-1.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 disabled:opacity-60 dark:text-slate-100 dark:placeholder:text-slate-600"
        />
        <button
          type="submit"
          disabled={busy || input.trim().length < 3}
          className="text-[12px] font-semibold uppercase tracking-wider text-slate-900 transition hover:text-cyan-600 disabled:opacity-30 dark:text-slate-100 dark:hover:text-cyan-400"
        >
          {busy ? "…" : "send →"}
        </button>
      </form>
    </section>
  );
}
