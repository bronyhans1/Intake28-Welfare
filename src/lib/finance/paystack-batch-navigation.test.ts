import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPaystackBatchNavigation,
  getPaystackBatchNavigationUiState,
  resolveBatchFromSearchParam,
} from "@/lib/finance/paystack-batch-navigation";
import { paystackBatchPath } from "@/lib/finance/reconciliation-view";

describe("paystack batch navigation helpers", () => {
  it("builds previous and next hrefs from existing batch paths", () => {
    expect(
      buildPaystackBatchNavigation({ batch: 2, hasPrevious: true, hasNext: true }),
    ).toEqual({
      batch: 2,
      hasPrevious: true,
      hasNext: true,
      previousHref: paystackBatchPath(1),
      nextHref: paystackBatchPath(3),
    });
    expect(paystackBatchPath(1)).toBe("/admin/finance/reconciliation");
    expect(paystackBatchPath(2)).toBe("/admin/finance/reconciliation?paystackBatch=2");
  });

  it("disables both controls and shows loading while navigating", () => {
    expect(
      getPaystackBatchNavigationUiState({
        hasPrevious: true,
        hasNext: true,
        isNavigating: true,
        error: null,
      }),
    ).toEqual({
      showLoading: true,
      previousDisabled: true,
      nextDisabled: true,
      showError: false,
    });
  });

  it("clears loading after navigation and restores boundary disables", () => {
    expect(
      getPaystackBatchNavigationUiState({
        hasPrevious: false,
        hasNext: true,
        isNavigating: false,
        error: null,
      }),
    ).toEqual({
      showLoading: false,
      previousDisabled: true,
      nextDisabled: false,
      showError: false,
    });

    expect(
      getPaystackBatchNavigationUiState({
        hasPrevious: true,
        hasNext: false,
        isNavigating: false,
        error: null,
      }),
    ).toEqual({
      showLoading: false,
      previousDisabled: false,
      nextDisabled: true,
      showError: false,
    });
  });

  it("shows error and re-enables controls after a failed navigation", () => {
    expect(
      getPaystackBatchNavigationUiState({
        hasPrevious: true,
        hasNext: true,
        isNavigating: false,
        error: "Could not load that batch. Please try again.",
      }),
    ).toEqual({
      showLoading: false,
      previousDisabled: false,
      nextDisabled: false,
      showError: true,
    });
  });

  it("does not show error while a retry navigation is in progress", () => {
    expect(
      getPaystackBatchNavigationUiState({
        hasPrevious: true,
        hasNext: true,
        isNavigating: true,
        error: "Could not load that batch. Please try again.",
      }).showError,
    ).toBe(false);
  });

  it("resolves batch query parameters consistently", () => {
    expect(resolveBatchFromSearchParam(null)).toBe(1);
    expect(resolveBatchFromSearchParam("")).toBe(1);
    expect(resolveBatchFromSearchParam("2")).toBe(2);
    expect(resolveBatchFromSearchParam("nope")).toBe(1);
  });
});

describe("paystack batch navigation component wiring", () => {
  const overviewSource = readFileSync(
    join(process.cwd(), "src/components/admin/reconciliation-overview.tsx"),
    "utf8",
  );
  const navSource = readFileSync(
    join(process.cwd(), "src/components/admin/paystack-batch-navigation.tsx"),
    "utf8",
  );

  it("uses the loading navigation component instead of bare links", () => {
    expect(overviewSource).toContain("PaystackBatchNavigation");
    expect(overviewSource).not.toContain("paystackBatchPath(");
    expect(navSource).toContain("Loading batch…");
    expect(navSource).toContain("Loader2");
    expect(navSource).toContain('role="status"');
    expect(navSource).toContain("router.push");
    expect(navSource).toContain("Retry");
    expect(navSource).toContain("disabled={ui.previousDisabled}");
    expect(navSource).toContain("disabled={ui.nextDisabled}");
  });
});
