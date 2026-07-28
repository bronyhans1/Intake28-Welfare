"use client";

import { cn } from "@/lib/utils";

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-slate-200/80",
        className,
      )}
    />
  );
}

interface SkeletonCardProps {
  className?: string;
  lines?: number;
}

/** Placeholder card for dashboard statistics while data loads. */
export function SkeletonCard({ className, lines = 2 }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-black/[0.08] bg-white p-6 shadow-sm",
        className,
      )}
      aria-hidden
    >
      <div className="flex items-start justify-between gap-4">
        <div className="w-full space-y-3">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-8 w-20" />
          {Array.from({ length: lines }).map((_, index) => (
            <SkeletonBlock
              key={index}
              className={cn("h-3", index === 0 ? "w-40" : "w-28")}
            />
          ))}
        </div>
        <SkeletonBlock className="size-11 shrink-0 rounded-xl" />
      </div>
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

/** Placeholder table while list data loads. */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: SkeletonTableProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-sm",
        className,
      )}
      aria-busy="true"
      aria-label="Loading table"
    >
      <div className="border-b border-black/[0.06] bg-slate-50/80 px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, index) => (
            <SkeletonBlock key={index} className="h-3 w-20" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-black/[0.05]">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 px-4 py-3.5">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <SkeletonBlock
                key={colIndex}
                className={cn(
                  "h-3",
                  colIndex === 0 ? "w-32" : "w-16 flex-1",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
