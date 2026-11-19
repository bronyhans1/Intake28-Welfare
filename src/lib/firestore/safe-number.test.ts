import { describe, expect, it } from "vitest";
import { safeNumber } from "./safe-number";

describe("safeNumber", () => {
  it("returns finite numbers unchanged", () => {
    expect(safeNumber(3)).toBe(3);
    expect(safeNumber(0)).toBe(0);
  });

  it("replaces NaN and Infinity with fallback", () => {
    expect(safeNumber(Number.NaN)).toBe(0);
    expect(safeNumber(Number.POSITIVE_INFINITY)).toBe(0);
    expect(safeNumber(Number.NEGATIVE_INFINITY, 5)).toBe(5);
  });

  it("parses numeric strings", () => {
    expect(safeNumber("12")).toBe(12);
    expect(safeNumber(" 4 ")).toBe(4);
  });

  it("uses fallback for invalid values", () => {
    expect(safeNumber(undefined, 2)).toBe(2);
    expect(safeNumber(null, 2)).toBe(2);
    expect(safeNumber("not-a-number", 7)).toBe(7);
  });
});
