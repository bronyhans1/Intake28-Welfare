"use client";

import { LoadingSpinner } from "@/components/loading/loading-spinner";
import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  open: boolean;
  title: string;
  message?: string;
  className?: string;
}

/** Full-screen modal overlay for blocking async operations. */
export function LoadingOverlay({
  open,
  title,
  message,
  className,
}: LoadingOverlayProps) {
  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]",
        className,
      )}
    >
      <div className="w-full max-w-sm rounded-2xl border border-black/[0.08] bg-white px-6 py-8 text-center shadow-xl">
        <LoadingSpinner size="lg" label={title} className="mx-auto" />
        <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
        {message ? (
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        ) : null}
      </div>
    </div>
  );
}
