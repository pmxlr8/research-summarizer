type Phase = {
  label: string;
  title: string;
  when: string;
  summary: string;
};

export function PhaseTimeline({ phases }: { phases: Phase[] }) {
  return (
    <ol className="mt-10 space-y-4">
      {phases.map((p, i) => (
        <li
          key={p.label}
          className="group relative flex gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
        >
          <div className="flex w-24 shrink-0 flex-col items-start">
            <span className="inline-flex items-center rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">
              {p.label}
            </span>
            <span className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {p.when}
            </span>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">{p.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {p.summary}
            </p>
          </div>
          <div className="hidden text-right sm:block">
            <span className="text-xs text-slate-400">
              {String(i + 1).padStart(2, "0")} / {String(phases.length).padStart(2, "0")}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
