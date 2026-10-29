import { describe, expect, it } from "vitest";
import {
  validateHubtelAmount,
  validateHubtelCurrency,
  validateHubtelReference,
} from "@/lib/payments/hubtel-settlement-rules";
import { PaymentSettlementError } from "@/lib/payments/paystack-settlement-rules";

describe("hubtel settlement rules", () => {
  it("accepts matching references and amounts", () => {
    expect(() =>
      validateHubtelReference("GIS-REF-1", "GIS-REF-1"),
    ).not.toThrow();
    expect(() =>
      validateHubtelAmount({ amount: 50, checkoutAmount: 50 }, { amount: 50 }),
    ).not.toThrow();
    expect(() =>
      validateHubtelCurrency({ currency: "GHS" }, "GHS"),
    ).not.toThrow();
  });

  it("rejects reference mismatches", () => {
    expect(() => validateHubtelReference("GIS-A", "GIS-B")).toThrow(
      PaymentSettlementError,
    );
  });

  it("rejects amount mismatches, missing amounts, and non-finite amounts", () => {
    expect(() =>
      validateHubtelAmount({ amount: 50, checkoutAmount: 50 }, { amount: 40 }),
    ).toThrow(/amount/i);
    expect(() =>
      validateHubtelAmount({ amount: 50, checkoutAmount: 50 }, { amount: null }),
    ).toThrow(/missing a transaction amount/i);
    expect(() =>
      validateHubtelAmount(
        { amount: 50, checkoutAmount: 50 },
        { amount: Number.NaN },
      ),
    ).toThrow(/missing a transaction amount/i);
  });

  it("validates against checkoutAmount when present (fixture only — no live fee)", () => {
    expect(() =>
      validateHubtelAmount({ amount: 50, checkoutAmount: 51 }, { amount: 51 }),
    ).not.toThrow();
    expect(() =>
      validateHubtelAmount({ amount: 50, checkoutAmount: 51 }, { amount: 50 }),
    ).toThrow(/amount/i);
    expect(() =>
      validateHubtelAmount({ amount: 50, checkoutAmount: 51 }, { amount: 52 }),
    ).toThrow(/amount/i);
  });

  it("keeps the existing GH₵0.005 tolerance around expected checkout", () => {
    expect(() =>
      validateHubtelAmount(
        { amount: 50, checkoutAmount: 51 },
        { amount: 51.004 },
      ),
    ).not.toThrow();
    expect(() =>
      validateHubtelAmount(
        { amount: 50, checkoutAmount: 51 },
        { amount: 51.006 },
      ),
    ).toThrow(/amount/i);
  });

  it("falls back to official amount for legacy payments without checkoutAmount", () => {
    expect(() =>
      validateHubtelAmount({ amount: 50 }, { amount: 50 }),
    ).not.toThrow();
    expect(() =>
      validateHubtelAmount({ amount: 50, checkoutAmount: null }, { amount: 50 }),
    ).not.toThrow();
    expect(() =>
      validateHubtelAmount({ amount: 50 }, { amount: 51 }),
    ).toThrow(/amount/i);
  });

  it("skips currency when Hubtel omits it, rejects mismatches", () => {
    expect(() =>
      validateHubtelCurrency({ currency: "GHS" }, null),
    ).not.toThrow();
    expect(() =>
      validateHubtelCurrency({ currency: "GHS" }, "USD"),
    ).toThrow(/currency/i);
  });
});
