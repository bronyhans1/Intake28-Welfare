import { describe, expect, it } from "vitest";
import {
  formatOutstandingMonthsDisplay,
  resolveOutstandingBalance,
} from "@/lib/progression/outstanding-display";

describe("outstanding display helpers", () => {
  it("formats month labels with executive-friendly bullets", () => {
    expect(formatOutstandingMonthsDisplay(["June 2026", "July 2026"])).toBe(
      "June 2026 • July 2026",
    );
    expect(
      formatOutstandingMonthsDisplay([
        { month: 6, year: 2026 },
        { month: 7, year: 2026 },
      ]),
    ).toBe("June 2026 • July 2026");
  });

  it("computes outstanding balance from months × dues", () => {
    expect(resolveOutstandingBalance(2, 50)).toBe(100);
    expect(resolveOutstandingBalance(0, 50)).toBe(0);
  });
});
