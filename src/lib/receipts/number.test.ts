import { describe, expect, it } from "vitest";
import { generateReceiptNumber, isReceiptNumber } from "@/lib/receipts/number";

describe("receipt number generation", () => {
  it("generates GIS-RCP reference format", () => {
    const receiptNumber = generateReceiptNumber(
      new Date("2026-06-18T12:00:00.000Z"),
      () => 0.123456,
    );

    expect(receiptNumber.startsWith("GIS-RCP-20260618-")).toBe(true);
    expect(isReceiptNumber(receiptNumber)).toBe(true);
  });

  it("rejects invalid receipt numbers", () => {
    expect(isReceiptNumber("GIS-20260618-AB1234")).toBe(false);
    expect(isReceiptNumber("GIS-RCP-20260618-AB12")).toBe(false);
  });
});
