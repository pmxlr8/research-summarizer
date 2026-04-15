type Props = { name: string; area: string };

export function TeamCard({ name, area }: Props) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-base font-bold text-white">
        {initials}
      </div>
      <h3 className="mt-4 text-base font-semibold">{name}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{area}</p>
    </div>
  );
}
