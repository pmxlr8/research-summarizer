"use client";

import { Fragment } from "react";
import type { ChatCitation } from "@/lib/api";

/**
 * Renders LLM answer text with [N] markers replaced by inline tooltip
 * pills. Hovering or focusing a pill reveals the underlying chunk
 * snippet without needing to expand the references section below.
 */
export function CitationText({
  text,
  citations,
}: {
  text: string;
  citations?: ChatCitation[];
}) {
  if (!citations || citations.length === 0) {
    return <p className="whitespace-pre-wrap">{text}</p>;
  }

  const parts = text.split(/(\[\d+\])/g);
  return (
    <p className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/);
        if (m) {
          const idx = Number(m[1]);
          const cite = citations.find((c) => c.index === idx);
          if (cite) return <CitationPill key={i} citation={cite} />;
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </p>
  );
}

function CitationPill({ citation }: { citation: ChatCitation }) {
  return (
    <span className="group/cite relative inline-block align-baseline">
      <span
        tabIndex={0}
        className="mx-0.5 inline-flex h-[18px] min-w-[18px] cursor-help items-center justify-center rounded-md border border-slate-300 bg-slate-100 px-1 align-[-2px] font-mono text-[10px] font-semibold text-slate-700 transition hover:border-cyan-500 hover:text-cyan-700 focus:border-cyan-500 focus:outline-none focus:text-cyan-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-cyan-400 dark:hover:text-cyan-300 dark:focus:border-cyan-400 dark:focus:text-cyan-300"
        aria-describedby={`cite-${citation.index}`}
      >
        {citation.index}
      </span>
      <span
        role="tooltip"
        id={`cite-${citation.index}`}
        className="invisible absolute left-1/2 top-full z-20 mt-2 w-[min(360px,80vw)] -translate-x-1/2 translate-y-1 rounded-lg border border-slate-200 bg-white p-3 text-[12px] leading-relaxed text-slate-700 opacity-0 shadow-lg transition group-hover/cite:visible group-hover/cite:translate-y-0 group-hover/cite:opacity-100 group-focus-within/cite:visible group-focus-within/cite:translate-y-0 group-focus-within/cite:opacity-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <div className="flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <span className="font-semibold">[{citation.index}]</span>
          <span>chunk {citation.chunkIndex + 1}</span>
          <span className="text-slate-400 dark:text-slate-600">·</span>
          <span>cosine {citation.score.toFixed(2)}</span>
        </div>
        <p className="mt-1.5 italic text-slate-600 dark:text-slate-300">
          {citation.snippet}
        </p>
      </span>
    </span>
  );
}
