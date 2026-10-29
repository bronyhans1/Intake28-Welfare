import { describe, expect, it } from "vitest";
import {
  resolveCheckoutAmountBreakdown,
  resolveExpectedCheckoutAmount,
  roundMajorCurrencyAmount,
} from "@/lib/payments/checkout-amount";

describe("checkout amount helper (Phase 1 — zero surcharge)", () => {
  it("produces checkout equal to official amount and zero processing fee", () => {
    expect(resolveCheckoutAmountBreakdown(50)).toEqual({
      amount: 50,
      checkoutAmount: 50,
      processingFeeAmount: 0,
    });
  });

  it("rejects non-positive official amounts", () => {
    expect(() => resolveCheckoutAmountBreakdown(0)).toThrow(/positive/i);
    expect(() => resolveCheckoutAmountBreakdown(-1)).toThrow(/positive/i);
    expect(() => resolveCheckoutAmountBreakdown(Number.NaN)).toThrow(/positive/i);
  });

  it("rounds to two decimal places consistently", () => {
    expect(roundMajorCurrencyAmount(50.005)).toBe(50.01);
    expect(resolveCheckoutAmountBreakdown(50.004)).toEqual({
      amount: 50,
      checkoutAmount: 50,
      processingFeeAmount: 0,
    });
  });

  it("resolves expected checkout with legacy fallback to amount", () => {
    expect(
      resolveExpectedCheckoutAmount({ amount: 50, checkoutAmount: 51 }),
    ).toBe(51);
    expect(
      resolveExpectedCheckoutAmount({ amount: 50, checkoutAmount: null }),
    ).toBe(50);
    expect(resolveExpectedCheckoutAmount({ amount: 50 })).toBe(50);
  });
});
