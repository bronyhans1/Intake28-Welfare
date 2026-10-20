"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  buildPaystackBatchNavigation,
  getPaystackBatchNavigationUiState,
  resolveBatchFromSearchParam,
} from "@/lib/finance/paystack-batch-navigation";

interface PaystackBatchNavigationProps {
  batch: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

const NAV_ERROR = "Could not load that batch. Please try again.";

export function PaystackBatchNavigation({
  batch,
  hasPrevious,
  hasNext,
}: PaystackBatchNavigationProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expectedBatch, setExpectedBatch] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryHref, setRetryHref] = useState<string | null>(null);

  const model = buildPaystackBatchNavigation({ batch, hasPrevious, hasNext });
  const isNavigating = isPending || expectedBatch != null;
  const ui = getPaystackBatchNavigationUiState({
    hasPrevious,
    hasNext,
    isNavigating,
    error,
  });

  useEffect(() => {
    if (expectedBatch == null) return;
    if (batch === expectedBatch) {
      setExpectedBatch(null);
      setError(null);
      setRetryHref(null);
    }
  }, [batch, expectedBatch]);

  useEffect(() => {
    if (expectedBatch == null || isPending) return;
    if (batch === expectedBatch) return;
    setError(NAV_ERROR);
    setExpectedBatch(null);
  }, [isPending, expectedBatch, batch]);

  function navigate(targetBatch: number, href: string) {
    if (isNavigating) return;
    setError(null);
    setRetryHref(href);
    setExpectedBatch(targetBatch);
    startTransition(() => {
      router.push(href);
    });
  }

  function retry() {
    if (!retryHref || isNavigating) return;
    const target = resolveBatchFromSearchParam(
      new URL(retryHref, "http://local.invalid").searchParams.get("paystackBatch"),
    );
    navigate(target, retryHref);
  }

  const controlClassName =
    "inline-flex rounded-lg border px-3 py-2 text-sm font-medium transition-colors";
  const enabledClassName = `${controlClassName} border-black/[0.12] text-[#166534] hover:bg-black/[0.03]`;
  const disabledClassName = `${controlClassName} cursor-not-allowed border-black/[0.06] text-muted-foreground opacity-70`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={ui.previousDisabled ? disabledClassName : enabledClassName}
          disabled={ui.previousDisabled}
          aria-disabled={ui.previousDisabled}
          onClick={() => {
            if (!model.previousHref) return;
            navigate(batch - 1, model.previousHref);
          }}
        >
          Previous batch
        </button>
        <button
          type="button"
          className={ui.nextDisabled ? disabledClassName : enabledClassName}
          disabled={ui.nextDisabled}
          aria-disabled={ui.nextDisabled}
          onClick={() => {
            if (!model.nextHref) return;
            navigate(batch + 1, model.nextHref);
          }}
        >
          Next batch
        </button>
        {ui.showLoading ? (
          <span
            className="inline-flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading batch…
          </span>
        ) : null}
      </div>
      {ui.showError ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-amber-800" role="alert">
          <span>{error}</span>
          {retryHref ? (
            <button type="button" className={enabledClassName} onClick={retry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
