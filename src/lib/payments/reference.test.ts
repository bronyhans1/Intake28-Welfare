import { describe, expect, it } from "vitest";
import {
  generatePaymentReference,
  generatePaymentReferenceSuffix,
  isPaymentReference,
} from "@/lib/payments/reference";

describe("generatePaymentReferenceSuffix", () => {
  it("returns uppercase alphanumeric suffix", () => {
    const suffix = generatePaymentReferenceSuffix(6, () => 0);
    expect(suffix).toHaveLength(6);
    expect(suffix).toMatch(/^[A-Z0-9]+$/);
  });
});

describe("generatePaymentReference", () => {
  it("builds reference with GIS date prefix", () => {
    const reference = generatePaymentReference(
      new Date("2026-06-17T08:30:00.000Z"),
      () => 0.5,
    );

    expect(reference.startsWith("GIS-20260617-")).toBe(true);
    expect(isPaymentReference(reference)).toBe(true);
  });
});
