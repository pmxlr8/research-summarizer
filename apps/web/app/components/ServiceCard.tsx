type Props = {
  name: string;
  role: string;
  description: string;
};

export function ServiceCard({ name, role, description }: Props) {
  return (
    <div className="group conic-ring card-lift relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400 via-indigo-500 to-violet-500 opacity-0 transition group-hover:opacity-100" />
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {role}
      </p>
      <h3 className="mt-2 text-lg font-semibold">{name}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {description}
      </p>
    </div>
  );
}
