import { describe, expect, it } from "vitest";
import {
  formatClaimNumber,
  isValidClaimNumber,
  parseClaimNumber,
} from "@/lib/claims/claim-number";

describe("formatClaimNumber", () => {
  it("formats sequential claim numbers", () => {
    expect(formatClaimNumber(2026, 1)).toBe("GIS-2026-00001");
    expect(formatClaimNumber(2026, 2)).toBe("GIS-2026-00002");
    expect(formatClaimNumber(2026, 15)).toBe("GIS-2026-00015");
  });

  it("rejects invalid year or sequence", () => {
    expect(() => formatClaimNumber(1999, 1)).toThrow();
    expect(() => formatClaimNumber(2026, 0)).toThrow();
  });
});

describe("parseClaimNumber", () => {
  it("parses valid claim numbers", () => {
    expect(parseClaimNumber("GIS-2026-00001")).toEqual({
      year: 2026,
      sequence: 1,
    });
    expect(isValidClaimNumber("gis-2026-00003")).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(parseClaimNumber("DRAFT-ABCDEF")).toBeNull();
    expect(isValidClaimNumber("GIS-26-1")).toBe(false);
  });
});
