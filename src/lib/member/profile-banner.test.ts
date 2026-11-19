import { describe, expect, it } from "vitest";
import { shouldShowProfileCompletionBanner } from "@/lib/member/profile-banner";

describe("shouldShowProfileCompletionBanner", () => {
  it("shows the banner below 100%", () => {
    expect(shouldShowProfileCompletionBanner(0)).toBe(true);
    expect(shouldShowProfileCompletionBanner(75)).toBe(true);
    expect(shouldShowProfileCompletionBanner(99)).toBe(true);
  });

  it("hides the banner at 100%", () => {
    expect(shouldShowProfileCompletionBanner(100)).toBe(false);
  });
});
