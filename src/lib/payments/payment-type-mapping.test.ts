import { describe, expect, it } from "vitest";
import {
  mapPaymentTypeToContributionType,
  normalizePaymentType,
  resolveContributionTypeFromPayment,
} from "@/lib/payments/payment-type-mapping";
import { ContributionType, PaymentType } from "@/types/enums";

describe("normalizePaymentType", () => {
  it("accepts canonical payment type values", () => {
    expect(normalizePaymentType(PaymentType.MONTHLY_DUES)).toBe(PaymentType.MONTHLY_DUES);
    expect(normalizePaymentType(PaymentType.SPECIAL_CONTRIBUTION)).toBe(
      PaymentType.SPECIAL_CONTRIBUTION,
    );
    expect(normalizePaymentType(PaymentType.OTHER)).toBe(PaymentType.OTHER);
  });

  it("normalizes legacy aliases", () => {
    expect(normalizePaymentType("special")).toBe(PaymentType.SPECIAL_CONTRIBUTION);
  });

  it("returns null for invalid values", () => {
    expect(normalizePaymentType("")).toBeNull();
    expect(normalizePaymentType("monthly-dues")).toBeNull();
    expect(normalizePaymentType(null)).toBeNull();
  });
});

describe("mapPaymentTypeToContributionType", () => {
  it("maps supported payment types", () => {
    expect(mapPaymentTypeToContributionType(PaymentType.MONTHLY_DUES)).toBe(
      ContributionType.MONTHLY_DUES,
    );
    expect(mapPaymentTypeToContributionType(PaymentType.SPECIAL_CONTRIBUTION)).toBe(
      ContributionType.SPECIAL_CONTRIBUTION,
    );
    expect(mapPaymentTypeToContributionType(PaymentType.OTHER)).toBe(ContributionType.OTHER);
    expect(() =>
      mapPaymentTypeToContributionType(PaymentType.CLAIM_PAYMENT),
    ).toThrow(/not mapped to contribution/i);
  });
});

describe("resolveContributionTypeFromPayment", () => {
  it("resolves canonical and legacy payment types", () => {
    expect(resolveContributionTypeFromPayment(PaymentType.SPECIAL_CONTRIBUTION)).toBe(
      ContributionType.SPECIAL_CONTRIBUTION,
    );
    expect(resolveContributionTypeFromPayment("special")).toBe(
      ContributionType.SPECIAL_CONTRIBUTION,
    );
  });

  it("returns null for invalid payment types", () => {
    expect(resolveContributionTypeFromPayment("invalid")).toBeNull();
  });
});
