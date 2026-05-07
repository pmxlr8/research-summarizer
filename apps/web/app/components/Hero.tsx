import Link from "next/link";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-slate-200 grain dark:border-slate-800">
      <div className="absolute inset-0 -z-10 bg-grid" />
      <div className="absolute inset-0 -z-10 mesh-bg" />

      <div className="mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pb-32 sm:pt-28 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Week 2 · Design complete
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            NYU Cloud Computing · Spring 2026
          </span>
        </div>

        <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Summarize any research paper, <span className="gradient-text">in seconds</span>.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          A serverless AWS platform that searches open-access academic repositories,
          fetches full-text PDFs, and produces structured summaries using Claude
          Sonnet on Amazon Bedrock — objectives, methodology, results,
          limitations, contributions.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Get started
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white/70 px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur transition hover:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            Sign in
          </Link>
          <Link
            href="#architecture"
            className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-slate-700 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
          >
            View architecture ↓
          </Link>
        </div>

        <dl className="mt-16 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat value="100%" label="Serverless" />
          <Stat value="5" label="Pipeline steps" />
          <Stat value="12" label="AWS services" />
          <Stat value="< 90s" label="Summary P95" />
        </dl>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-l-2 border-slate-900 pl-4 dark:border-slate-100">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold sm:text-3xl">{value}</dd>
    </div>
  );
}
