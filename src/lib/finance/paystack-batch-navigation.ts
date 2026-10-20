import { paystackBatchPath } from "@/lib/finance/reconciliation-view";

export type PaystackBatchNavigationModel = {
  batch: number;
  hasPrevious: boolean;
  hasNext: boolean;
  previousHref: string | null;
  nextHref: string | null;
};

export function buildPaystackBatchNavigation(input: {
  batch: number;
  hasPrevious: boolean;
  hasNext: boolean;
}): PaystackBatchNavigationModel {
  return {
    batch: input.batch,
    hasPrevious: input.hasPrevious,
    hasNext: input.hasNext,
    previousHref: input.hasPrevious ? paystackBatchPath(input.batch - 1) : null,
    nextHref: input.hasNext ? paystackBatchPath(input.batch + 1) : null,
  };
}

export type PaystackBatchNavigationUiState = {
  showLoading: boolean;
  previousDisabled: boolean;
  nextDisabled: boolean;
  showError: boolean;
};

/**
 * Pure UI state for batch controls during App Router transitions.
 */
export function getPaystackBatchNavigationUiState(input: {
  hasPrevious: boolean;
  hasNext: boolean;
  isNavigating: boolean;
  error: string | null;
}): PaystackBatchNavigationUiState {
  return {
    showLoading: input.isNavigating,
    previousDisabled: !input.hasPrevious || input.isNavigating,
    nextDisabled: !input.hasNext || input.isNavigating,
    showError: Boolean(input.error) && !input.isNavigating,
  };
}

export function resolveBatchFromSearchParam(raw: string | null): number {
  if (raw == null || raw.trim() === "") return 1;
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
}
