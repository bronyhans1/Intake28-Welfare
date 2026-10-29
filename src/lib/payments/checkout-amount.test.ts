import { describe, expect, it } from "vitest";
import {
  HUBTEL_ONLINE_CHECKOUT_PROCESSING_FEE_PERCENT,
  calculateHubtelProcessingFeePesewas,
  fromPesewas,
  resolveCheckoutAmountBreakdown,
  resolveExpectedCheckoutAmount,
  roundMajorCurrencyAmount,
  toPesewas,
} from "@/lib/payments/checkout-amount";

describe("checkout amount helper (Hubtel 2% processing fee)", () => {
  it("uses a 2% processing fee rate", () => {
    expect(HUBTEL_ONLINE_CHECKOUT_PROCESSING_FEE_PERCENT).toBe(2);
  });

  it("produces GH₵51 checkout for a GH₵50 official contribution", () => {
    expect(resolveCheckoutAmountBreakdown(50)).toEqual({
      amount: 50,
      checkoutAmount: 51,
      processingFeeAmount: 1,
    });
  });

  it("produces GH₵102 checkout for a GH₵100 official contribution", () => {
    expect(resolveCheckoutAmountBreakdown(100)).toEqual({
      amount: 100,
      checkoutAmount: 102,
      processingFeeAmount: 2,
    });
  });

  it("produces GH₵204 checkout for a GH₵200 official contribution", () => {
    expect(resolveCheckoutAmountBreakdown(200)).toEqual({
      amount: 200,
      checkoutAmount: 204,
      processingFeeAmount: 4,
    });
  });

  it("calculates the fee in integer pesewas with nearest-pesewa rounding", () => {
    // 33.33 → 3333 pesewas; 2% = 66.66 → rounds to 67 pesewas (GH₵0.67)
    expect(toPesewas(33.33)).toBe(3333);
    expect(calculateHubtelProcessingFeePesewas(3333)).toBe(67);
    expect(resolveCheckoutAmountBreakdown(33.33)).toEqual({
      amount: 33.33,
      processingFeeAmount: fromPesewas(67),
      checkoutAmount: fromPesewas(3333 + 67),
    });

    // Exactly halfway between pesewas on the fee: 25.00 → 500 pesewas fee before
    // percent? 2500 * 2 / 100 = 50 exactly → 0.50
    expect(calculateHubtelProcessingFeePesewas(2500)).toBe(50);
    expect(resolveCheckoutAmountBreakdown(25)).toEqual({
      amount: 25,
      checkoutAmount: 25.5,
      processingFeeAmount: 0.5,
    });
  });

  it("rejects non-positive official amounts and non-positive pesewa inputs", () => {
    expect(() => resolveCheckoutAmountBreakdown(0)).toThrow(/positive/i);
    expect(() => resolveCheckoutAmountBreakdown(-1)).toThrow(/positive/i);
    expect(() => resolveCheckoutAmountBreakdown(Number.NaN)).toThrow(/positive/i);
    expect(() => calculateHubtelProcessingFeePesewas(0)).toThrow(/positive/i);
    expect(() => calculateHubtelProcessingFeePesewas(-100)).toThrow(/positive/i);
    expect(() => calculateHubtelProcessingFeePesewas(1.5)).toThrow(/positive/i);
  });

  it("rounds major units to two decimal places before fee math", () => {
    expect(roundMajorCurrencyAmount(50.005)).toBe(50.01);
    // 50.004 → 50.00 pesewas path via toPesewas → same as 50
    expect(resolveCheckoutAmountBreakdown(50.004)).toEqual({
      amount: 50,
      checkoutAmount: 51,
      processingFeeAmount: 1,
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
