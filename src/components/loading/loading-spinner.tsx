"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "size-4",
  md: "size-5",
  lg: "size-8",
} as const;

export type LoadingSpinnerSize = keyof typeof sizeClasses;

interface LoadingSpinnerProps {
  size?: LoadingSpinnerSize;
  className?: string;
  label?: string;
}

/** Primary reusable spinner — use everywhere instead of ad-hoc Loader2. */
export function LoadingSpinner({
  size = "md",
  className,
  label = "Loading",
}: LoadingSpinnerProps) {
  return (
    <Loader2
      role="status"
      aria-label={label}
      className={cn(
        "animate-spin text-[#166534]",
        sizeClasses[size],
        className,
      )}
    />
  );
}

/** Compact spinner for buttons (inherits current text colour). */
export function ButtonSpinner({ className }: { className?: string }) {
  return (
    <Loader2
      aria-hidden
      className={cn("size-4 shrink-0 animate-spin", className)}
    />
  );
}
