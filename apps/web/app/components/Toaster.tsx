"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ToastVariant = "info" | "success" | "warning" | "error";
type Toast = { id: number; variant: ToastVariant; message: string };

type ToastApi = {
  push: (variant: ToastVariant, message: string) => void;
  success: (msg: string) => void;
  info: (msg: string) => void;
  warning: (msg: string) => void;
  error: (msg: string) => void;
};

const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be used inside <ToasterProvider>");
  return v;
}

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((variant: ToastVariant, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, variant, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 5000);
  }, []);

  const api: ToastApi = {
    push,
    success: (msg) => push("success", msg),
    info: (msg) => push("info", msg),
    warning: (msg) => push("warning", msg),
    error: (msg) => push("error", msg),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:top-6">
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onDismiss={() => setToasts((all) => all.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 10);
    return () => clearTimeout(t);
  }, []);

  const variantStyles: Record<ToastVariant, string> = {
    info: "border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
    success: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100",
    warning: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100",
    error: "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100",
  };

  return (
    <div
      className={`pointer-events-auto w-full max-w-sm transform rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur transition-all ${variantStyles[toast.variant]} ${shown ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="flex-1 leading-relaxed">{toast.message}</span>
        <button
          onClick={onDismiss}
          className="text-current opacity-50 hover:opacity-100"
          aria-label="dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
