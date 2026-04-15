import { ReactNode } from "react";

type Props = {
  id?: string;
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
};

export function Section({ id, eyebrow, title, intro, children }: Props) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-16 px-6 py-20 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
        {eyebrow}
      </p>
      <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {intro ? (
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
          {intro}
        </p>
      ) : null}
      {children}
    </section>
  );
}
