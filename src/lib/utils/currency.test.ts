import { describe, expect, it } from "vitest";
import { formatCurrency, parseAmount } from "@/lib/utils/currency";

describe("formatCurrency", () => {
  it("formats whole number amounts", () => {
    expect(formatCurrency(500)).toBe("GHS 500.00");
  });

  it("formats decimal amounts", () => {
    expect(formatCurrency(1250.75)).toBe("GHS 1,250.75");
  });

  it("formats small decimal amounts", () => {
    expect(formatCurrency(500.5)).toBe("GHS 500.50");
  });

  it("formats zero as GHS 0.00", () => {
    expect(formatCurrency(0)).toBe("GHS 0.00");
  });

  it("uses thousands separator for large amounts", () => {
    expect(formatCurrency(10000)).toBe("GHS 10,000.00");
  });

  it("supports custom currency code", () => {
    expect(formatCurrency(500, { currency: "USD" })).toBe("USD 500.00");
  });
});

describe("parseAmount", () => {
  it("parses a plain number string", () => {
    expect(parseAmount("500")).toBe(500);
  });

  it("parses a decimal string", () => {
    expect(parseAmount("500.50")).toBe(500.5);
  });

  it("strips non-numeric characters", () => {
    expect(parseAmount("GHS 500")).toBe(500);
  });

  it("returns null for empty string", () => {
    expect(parseAmount("")).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(parseAmount("abc")).toBeNull();
  });
});
