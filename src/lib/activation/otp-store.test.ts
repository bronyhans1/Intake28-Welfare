import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOtpCode,
  generateOtpCode,
  getOtpExpiryMs,
  hasActiveOtpCode,
  isOtpCodeExpired,
  resetOtpStoreForTests,
  storeOtpCode,
  verifyOtpCode,
} from "@/lib/activation/otp-store";

describe("otp-store", () => {
  beforeEach(() => {
    resetOtpStoreForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates a 6-digit OTP", () => {
    const otp = generateOtpCode();
    expect(otp).toMatch(/^\d{6}$/);
    expect(Number(otp)).toBeGreaterThanOrEqual(100000);
    expect(Number(otp)).toBeLessThan(1000000);
  });

  it("stores and verifies a valid OTP once", () => {
    storeOtpCode("user-1", "123456");
    expect(hasActiveOtpCode("user-1")).toBe(true);
    expect(verifyOtpCode("user-1", "123456")).toBe(true);
    expect(hasActiveOtpCode("user-1")).toBe(false);
  });

  it("rejects invalid OTP without consuming a valid code", () => {
    storeOtpCode("user-1", "123456");
    expect(verifyOtpCode("user-1", "000000")).toBe(false);
    expect(hasActiveOtpCode("user-1")).toBe(true);
  });

  it("expires OTP after 10 minutes", () => {
    const now = new Date("2026-06-14T12:00:00Z");
    storeOtpCode("user-1", "123456", now);

    vi.setSystemTime(new Date(getOtpExpiryMs(now)));
    expect(isOtpCodeExpired(getOtpExpiryMs(now))).toBe(true);
    expect(verifyOtpCode("user-1", "123456")).toBe(false);
  });

  it("clears OTP codes explicitly", () => {
    storeOtpCode("user-1", "123456");
    clearOtpCode("user-1");
    expect(hasActiveOtpCode("user-1")).toBe(false);
  });
});
