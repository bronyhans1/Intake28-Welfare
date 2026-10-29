import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getContributionPaymentMode,
  isManualMomoContributionMode,
  MANUAL_MOMO_ACCOUNT,
} from "@/lib/payments/manual-momo";

describe("manual MoMo contribution mode (legacy)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("retains association MoMo account constants for finance reference only", () => {
    expect(MANUAL_MOMO_ACCOUNT).toEqual({
      network: "MTN",
      number: "0538815177",
      accountName: "Public Square / Benjamin Samason",
    });
  });

  it("defaults to unavailable when online payments are not enabled", () => {
    vi.stubEnv("PAYMENTS_ENABLED", "false");
    expect(getContributionPaymentMode()).toBe("unavailable");
    expect(isManualMomoContributionMode()).toBe(false);

    vi.stubEnv("PAYMENTS_ENABLED", undefined);
    delete process.env.PAYMENTS_ENABLED;
    expect(getContributionPaymentMode()).toBe("unavailable");
  });

  it("reports online mode only when PAYMENTS_ENABLED is true", () => {
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    expect(getContributionPaymentMode()).toBe("online");
    expect(isManualMomoContributionMode()).toBe(false);
  });
});
