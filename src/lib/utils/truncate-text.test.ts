import { describe, expect, it } from "vitest";
import { shouldTruncateText, truncateText } from "@/lib/utils/truncate-text";

describe("truncateText", () => {
  it("returns the original value when within the limit", () => {
    expect(truncateText("Short description", 80)).toBe("Short description");
  });

  it("truncates long values with an ellipsis", () => {
    const value = "A".repeat(100);
    expect(truncateText(value, 80)).toBe(`${"A".repeat(80)}…`);
    expect(shouldTruncateText(value, 80)).toBe(true);
  });
});
