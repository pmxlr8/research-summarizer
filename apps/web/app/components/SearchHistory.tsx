"use client";

import { useEffect, useState } from "react";
import { getSearchHistory, clearSearchHistory } from "@/lib/searchHistory";

export function SearchHistory({
  onPick,
  className,
}: {
  onPick: (q: string) => void;
  className?: string;
}) {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    setItems(getSearchHistory());
    function refresh() { setItems(getSearchHistory()); }
    window.addEventListener("rs:search-history-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("rs:search-history-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Recent searches
        </span>
        <button
          type="button"
          onClick={() => { clearSearchHistory(); }}
          className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          clear
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:border-cyan-500 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-cyan-400 dark:hover:text-cyan-300"
          >
            <span className="text-slate-400 dark:text-slate-500">↩</span>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
