"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listSummaries, getQuota } from "@/lib/api";
import type { Summary } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [summaries, setSummaries] = useState<Summary[] | null>(null);
  const [query, setQuery] = useState("");
  const [quota, setQuota] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function refresh() {
      try {
        const [next, q] = await Promise.all([listSummaries(), getQuota()]);
        if (cancelled) return;
        setSummaries(next);
        setQuota(q.quotaRemaining);
        const inFlight = next.some((s) => s.status === "pending" || s.status === "running");
        if (inFlight) timer = setTimeout(refresh, 5000);
      } catch {
        if (!cancelled) timer = setTimeout(refresh, 10_000);
      }
    }

    refresh();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/app/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  const doneCount = summaries?.filter((s) => s.status === "done").length ?? 0;
  const runningCount = summaries?.filter((s) => s.status === "running").length ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mt-8 flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search papers by title, author, or topic…"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Search
        </button>
      </form>

      {/* Stats */}
      <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Summaries generated" value={doneCount} />
        <Stat label="In progress" value={runningCount} />
        <Stat
          label="Quota remaining"
          value={quota === null ? "—" : quota}
          hint={quota === 0 ? "limit reached" : "out of 10 per period"}
        />
      </dl>

      {/* Recent summaries */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent summaries</h2>
        </div>

        {summaries === null ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              />
            ))}
          </div>
        ) : summaries.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {summaries.map((s) => (
              <SummaryCard key={s.id} s={s} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-3xl font-semibold">{value}</dd>
      {hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{hint}</p> : null}
    </div>
  );
}

function SummaryCard({ s }: { s: Summary }) {
  const badge =
    s.status === "done"
      ? { label: "Done", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" }
      : s.status === "running"
      ? { label: "Running", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" }
      : s.status === "failed"
      ? { label: "Failed", cls: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" }
      : { label: "Pending", cls: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200" };

  const href = s.status === "done" ? `/app/summary/${s.id}` : "#";
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
          {badge.label}
        </span>
        <time className="text-xs text-slate-500 dark:text-slate-500">
          {new Date(s.createdAt).toLocaleDateString()}
        </time>
      </div>
      <h3 className="mt-3 line-clamp-2 text-base font-semibold">{s.paper.title}</h3>
      <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
        {s.paper.authors.slice(0, 3).join(", ")}
        {s.paper.authors.length > 3 ? ` +${s.paper.authors.length - 3}` : ""}
      </p>
      {s.status === "running" ? (
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500" />
        </div>
      ) : s.durationSeconds ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">
          Generated in {s.durationSeconds}s · {s.keywords?.length ?? 0} keywords
        </p>
      ) : null}
    </>
  );

  if (s.status === "done") {
    return (
      <li>
        <Link
          href={href}
          className="block h-full rounded-xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
        >
          {content}
        </Link>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      {content}
    </li>
  );
}

function EmptyState() {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold">No summaries yet</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Search for a paper to generate your first summary.
      </p>
      <Link
        href="/app/search"
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
      >
        Start searching
      </Link>
    </div>
  );
}
