"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { requestPasswordReset, confirmPasswordReset } from "@/lib/auth";

function ForgotInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<"request" | "confirm" | "done">("request");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!email) throw new Error("Email is required");
      await requestPasswordReset(email);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start reset");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!code || !password) throw new Error("Code and new password required");
      if (password.length < 10) throw new Error("Password must be at least 10 characters");
      await confirmPasswordReset(email, code, password);
      setStep("done");
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6">
      <div className="absolute inset-0 -z-10 bg-grid" />
      <div className="absolute inset-0 -z-10 mesh-bg opacity-60" />

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
          ← Back to sign in
        </Link>

        {step === "request" ? (
          <>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Reset your password</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Enter the email on your account. We&apos;ll send a verification code.
            </p>
            <form onSubmit={handleRequest} className="mt-8 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="you@example.com"
                />
              </div>
              {error ? (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {loading ? "Sending..." : "Send code"}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
              Remembered it?{" "}
              <Link href="/login" className="font-medium text-cyan-600 hover:underline dark:text-cyan-400">
                Sign in
              </Link>
            </p>
          </>
        ) : step === "confirm" ? (
          <>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Enter the code</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              We sent a 6-digit code to <span className="font-medium">{email}</span>. Enter it
              below along with your new password.
            </p>
            <form onSubmit={handleConfirm} className="mt-8 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Verification code</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tracking-widest shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="123456"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">New password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="at least 10 chars, upper+lower+digit"
                />
              </div>
              {error ? (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {loading ? "Resetting..." : "Reset password"}
              </button>
              <button
                type="button"
                onClick={() => setStep("request")}
                className="block w-full text-center text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Use a different email
              </button>
            </form>
          </>
        ) : (
          <div className="mt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
              <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Password reset</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Redirecting you to sign in...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ForgotPage() {
  return (
    <Suspense fallback={null}>
      <ForgotInner />
    </Suspense>
  );
}
