"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSummary } from "@/lib/api";
import type { Summary } from "@/lib/types";

export default function SummaryPage({ params }: { params: { id: string } }) {
  const [summary, setSummary] = useState<Summary | null | undefined>(undefined);

  useEffect(() => {
    getSummary(params.id).then(setSummary);
  }, [params.id]);

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
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-500 dark:text-slate-400">
        <Link href="/app" className="hover:text-slate-700 dark:hover:text-slate-200">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700 dark:text-slate-200">Summary</span>
      </nav>

      {/* Paper header */}
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
            View original PDF
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z"
                clipRule="evenodd"
              />
              <path
                fillRule="evenodd"
                d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z"
                clipRule="evenodd"
              />
            </svg>
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

      {/* Abstract */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Abstract
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
          {summary.paper.abstract}
        </p>
      </section>

      {/* Structured summary sections */}
      <section className="mt-10 space-y-8">
        {summary.sections.map((sec) => (
          <div key={sec.heading}>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{sec.heading}</h2>
            <ul className="mt-3 space-y-2">
              {sec.bullets.map((b, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* Footer actions */}
      <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        <Link
          href="/app"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← Back to dashboard
        </Link>
        <div className="flex gap-2">
          <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            Copy summary
          </button>
          <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            Export as Markdown
          </button>
        </div>
      </div>
    </article>
  );
}
