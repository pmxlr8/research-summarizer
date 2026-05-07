"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSummary } from "@/lib/api";
import type { Summary } from "@/lib/types";
import { ChatPanel } from "@/app/components/ChatPanel";

export default function SummaryView({ id }: { id: string }) {
  const [summary, setSummary] = useState<Summary | null | undefined>(undefined);

  useEffect(() => {
    // Static export pre-renders this page with a placeholder id ("_view").
    // CloudFront rewrites every /app/summary/<id>/ request to that file,
    // so we read the *actual* id from the browser URL at runtime.
    const segments = window.location.pathname.split("/").filter(Boolean);
    const realId = segments[segments.length - 1];
    const effectiveId = realId && realId !== "_view" ? realId : id;
    getSummary(effectiveId).then(setSummary);
  }, [id]);

  if (summary === undefined) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      </div>
    );
  }

  if (summary === null) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Summary not found</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          It may have been deleted or never existed.
        </p>
        <Link
          href="/app"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-4xl px-6 py-10">
      <nav className="text-sm text-slate-500 dark:text-slate-400">
        <Link href="/app" className="hover:text-slate-700 dark:hover:text-slate-200">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700 dark:text-slate-200">Summary</span>
      </nav>

      <header className="mt-6 border-b border-slate-200 pb-6 dark:border-slate-800">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl">
          {summary.paper.title}
        </h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          {summary.paper.authors.join(", ")}
          {summary.paper.venue ? ` · ${summary.paper.venue} ${summary.paper.year}` : ` · ${summary.paper.year}`}
        </p>

        {summary.paper.pdfUrl ? (
          <a
            href={summary.paper.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            View original PDF ↗
          </a>
        ) : null}

        {summary.keywords && summary.keywords.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {summary.keywords.map((k) => (
              <span
                key={k}
                className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {k}
              </span>
            ))}
          </div>
        ) : null}

        <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
          <div>
            <dt className="inline font-medium">Generated </dt>
            <dd className="inline">{new Date(summary.createdAt).toLocaleString()}</dd>
          </div>
          {summary.durationSeconds ? (
            <div>
              <dt className="inline font-medium">Runtime </dt>
              <dd className="inline">{summary.durationSeconds}s</dd>
            </div>
          ) : null}
          <div>
            <dt className="inline font-medium">Model </dt>
            <dd className="inline">Claude Sonnet · Amazon Bedrock</dd>
          </div>
        </dl>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Abstract
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
          {summary.paper.abstract}
        </p>
      </section>

      <section className="mt-10 space-y-8">
        {summary.sections.map((sec) => (
          <div key={sec.heading}>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{sec.heading}</h2>
            <ul className="mt-3 space-y-2">
              {sec.bullets.map((b, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-cyan-400 via-indigo-500 to-violet-500" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {summary.status === "done" ? <ChatPanel jobId={summary.id} /> : null}

      <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        <Link
          href="/app"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← Back to dashboard
        </Link>
      </div>
    </article>
  );
}
