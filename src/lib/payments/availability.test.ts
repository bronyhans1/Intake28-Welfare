import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertPaymentsEnabled,
  isPaymentsEnabled,
  PAYMENTS_UNAVAILABLE_MESSAGE,
  PaymentsUnavailableError,
} from "@/lib/payments/availability";

describe("payment availability", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is disabled when PAYMENTS_ENABLED is missing", () => {
    vi.stubEnv("PAYMENTS_ENABLED", undefined);
    delete process.env.PAYMENTS_ENABLED;
    expect(isPaymentsEnabled()).toBe(false);
    expect(() => assertPaymentsEnabled()).toThrow(PaymentsUnavailableError);
    expect(() => assertPaymentsEnabled()).toThrow(PAYMENTS_UNAVAILABLE_MESSAGE);
  });

  it("is disabled when PAYMENTS_ENABLED is false or invalid", () => {
    for (const value of ["false", "FALSE", "0", "yes", "True", ""]) {
      vi.stubEnv("PAYMENTS_ENABLED", value);
      expect(isPaymentsEnabled()).toBe(false);
    }
  });

  it("is enabled only when PAYMENTS_ENABLED is exactly true", () => {
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    expect(isPaymentsEnabled()).toBe(true);
    expect(() => assertPaymentsEnabled()).not.toThrow();
  });
});
