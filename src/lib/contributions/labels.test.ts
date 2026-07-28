import { describe, expect, it } from "vitest";
import {
  formatContributionSourceLabel,
  resolveContributionSource,
} from "@/lib/contributions/labels";
import { ContributionSource } from "@/types/enums";

describe("contribution source labels", () => {
  it("defaults missing source to manual", () => {
    expect(resolveContributionSource(null)).toBe(ContributionSource.MANUAL);
    expect(formatContributionSourceLabel(null)).toBe("Manual");
  });

  it("formats paystack source", () => {
    expect(formatContributionSourceLabel(ContributionSource.PAYSTACK)).toBe("Paystack");
  });
});
