"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRelated, type RelatedPaper } from "@/lib/api";

export function RelatedPapers({ jobId }: { jobId: string }) {
  const [items, setItems] = useState<RelatedPaper[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRelated(jobId).then((r) => {
      if (!cancelled) setItems(r);
    });
    return () => { cancelled = true; };
  }, [jobId]);

  if (items === null) {
    return (
      <section className="mt-16 border-t border-slate-200 pt-10 dark:border-slate-800">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Related from your library
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-lg border border-slate-200 shimmer dark:border-slate-800" />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return null; // no peers, hide silently
  }

  return (
    <section className="mt-16 border-t border-slate-200 pt-10 dark:border-slate-800">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Related from your library
        </h2>
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          ranked by paper-level similarity
        </span>
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((r) => (
          <li key={r.id}>
            <Link
              href={`/app/summary/${r.id}`}
              className="card-lift block h-full rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  cosine {r.score.toFixed(2)}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {r.paper.year}
                </span>
              </div>
              <h3 className="mt-2 line-clamp-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
                {r.paper.title}
              </h3>
              <p className="mt-1 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
                {r.paper.authors.slice(0, 3).join(", ")}
                {r.paper.authors.length > 3 ? " +" + (r.paper.authors.length - 3) : ""}
              </p>
              {r.keywords.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {r.keywords.slice(0, 4).map((k) => (
                    <span key={k} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {k}
                    </span>
                  ))}
                </div>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
