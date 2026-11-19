"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error";

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 3500;

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const isSuccess = toast.variant === "success";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm",
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-rose-200 bg-rose-50 text-rose-900",
      )}
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
      ) : (
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-600" />
      )}
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        type="button"
        aria-label="Dismiss notification"
        className="shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
        onClick={() => onDismiss(toast.id)}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [...current, { id, message, variant }]);

      const timer = setTimeout(() => dismiss(id), TOAST_DURATION_MS);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      showSuccess: (message: string) => showToast(message, "success"),
      showError: (message: string) => showToast(message, "error"),
    }),
    [showToast],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:top-4 sm:right-4 sm:bottom-auto sm:items-end"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }
  return context;
}
