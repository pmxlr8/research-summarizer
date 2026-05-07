"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getSession, signOut, type Session } from "@/lib/auth";

const navItems = [
  { href: "/app", label: "Dashboard", icon: DashboardIcon },
  { href: "/app/search", label: "Search", icon: SearchIcon },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    setMounted(true);
  }, [router]);

  function handleSignOut() {
    signOut();
    router.replace("/");
  }

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-white" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Sidebar — fixed full-height column with the user block pinned to the bottom */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white/70 px-4 py-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60 md:flex">
        <Link href="/" className="flex items-center gap-2 px-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-400 via-indigo-500 to-violet-500" />
          <span className="text-sm font-semibold">Summarizer</span>
        </Link>

        <nav className="mt-8 flex-1 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User block — bottom of the column, never scrolls */}
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-indigo-500 to-violet-500 text-xs font-bold text-white">
              {(session?.user.name ?? session?.user.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{session?.user.name ?? session?.user.email}</p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {session?.user.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content — independently scrollable */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden dark:border-slate-800 dark:bg-slate-900">
          <Link href="/app" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-cyan-400 via-indigo-500 to-violet-500" />
            <span className="text-sm font-semibold">Summarizer</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Sign out
          </button>
        </header>

        {children}
      </main>
    </div>
  );
}

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 4.75A2.75 2.75 0 014.75 2h2.5A2.75 2.75 0 0110 4.75v2.5A2.75 2.75 0 017.25 10h-2.5A2.75 2.75 0 012 7.25v-2.5zM2 12.75A2.75 2.75 0 014.75 10h2.5A2.75 2.75 0 0110 12.75v2.5A2.75 2.75 0 017.25 18h-2.5A2.75 2.75 0 012 15.25v-2.5zM10 4.75A2.75 2.75 0 0112.75 2h2.5A2.75 2.75 0 0118 4.75v2.5A2.75 2.75 0 0115.25 10h-2.5A2.75 2.75 0 0110 7.25v-2.5zM10 12.75A2.75 2.75 0 0112.75 10h2.5A2.75 2.75 0 0118 12.75v2.5A2.75 2.75 0 0115.25 18h-2.5A2.75 2.75 0 0110 15.25v-2.5z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
        clipRule="evenodd"
      />
    </svg>
  );
}
