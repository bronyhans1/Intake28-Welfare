"use client";

import { LoadingSpinner } from "@/components/loading/loading-spinner";
import { cn } from "@/lib/utils";

interface PageLoaderProps {
  label?: string;
  className?: string;
  /** Compact inline variant for Suspense fallbacks inside a page shell */
  compact?: boolean;
}

/** Centred page-level loading indicator. */
export function PageLoader({
  label = "Loading…",
  className,
  compact = false,
}: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3 text-center",
        compact ? "min-h-[12rem] py-8" : "min-h-[40vh] px-4 py-16",
        className,
      )}
    >
      <LoadingSpinner size={compact ? "md" : "lg"} label={label} />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
