import {
  hubtelBatchPath,
  paystackBatchPath,
} from "@/lib/finance/reconciliation-view";

export type ProviderBatchNavigationModel = {
  batch: number;
  hasPrevious: boolean;
  hasNext: boolean;
  previousHref: string | null;
  nextHref: string | null;
};

export type ProviderBatchNavigationUiState = {
  showLoading: boolean;
  previousDisabled: boolean;
  nextDisabled: boolean;
  showError: boolean;
};

/**
 * Pure UI state for batch controls during App Router transitions.
 */
export function getProviderBatchNavigationUiState(input: {
  hasPrevious: boolean;
  hasNext: boolean;
  isNavigating: boolean;
  error: string | null;
}): ProviderBatchNavigationUiState {
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

export function buildPaystackBatchNavigation(input: {
  batch: number;
  hasPrevious: boolean;
  hasNext: boolean;
  companionHubtelBatch?: number;
}): ProviderBatchNavigationModel {
  const companion = input.companionHubtelBatch;
  return {
    batch: input.batch,
    hasPrevious: input.hasPrevious,
    hasNext: input.hasNext,
    previousHref: input.hasPrevious
      ? paystackBatchPath(input.batch - 1, companion)
      : null,
    nextHref: input.hasNext
      ? paystackBatchPath(input.batch + 1, companion)
      : null,
  };
}

export function buildHubtelBatchNavigation(input: {
  batch: number;
  hasPrevious: boolean;
  hasNext: boolean;
  companionPaystackBatch?: number;
}): ProviderBatchNavigationModel {
  const companion = input.companionPaystackBatch;
  return {
    batch: input.batch,
    hasPrevious: input.hasPrevious,
    hasNext: input.hasNext,
    previousHref: input.hasPrevious
      ? hubtelBatchPath(input.batch - 1, companion)
      : null,
    nextHref: input.hasNext
      ? hubtelBatchPath(input.batch + 1, companion)
      : null,
  };
}
