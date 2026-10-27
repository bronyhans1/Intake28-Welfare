import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getContributionPaymentMode,
  isManualMomoContributionMode,
  MANUAL_MOMO_ACCOUNT,
  MANUAL_MOMO_INSTRUCTIONS,
  MANUAL_MOMO_SECTION_TITLE,
} from "@/lib/payments/manual-momo";

describe("manual MoMo contribution mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes the configured association MoMo account details", () => {
    expect(MANUAL_MOMO_ACCOUNT).toEqual({
      network: "MTN",
      number: "0538815177",
      accountName: "Public Square / Benjamin Samason",
    });
    expect(MANUAL_MOMO_SECTION_TITLE).toBe("Pay Directly via Mobile Money");
    expect(MANUAL_MOMO_INSTRUCTIONS).toContain("GIS service number");
    expect(MANUAL_MOMO_INSTRUCTIONS).toContain("recorded manually");
  });

  it("defaults to manual MoMo when online payments are not enabled", () => {
    vi.stubEnv("PAYMENTS_ENABLED", "false");
    expect(getContributionPaymentMode()).toBe("manual_momo");
    expect(isManualMomoContributionMode()).toBe(true);

    vi.stubEnv("PAYMENTS_ENABLED", undefined);
    delete process.env.PAYMENTS_ENABLED;
    expect(getContributionPaymentMode()).toBe("manual_momo");
  });

  it("switches to online mode only when PAYMENTS_ENABLED is true", () => {
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    expect(getContributionPaymentMode()).toBe("online");
    expect(isManualMomoContributionMode()).toBe(false);
  });
});
