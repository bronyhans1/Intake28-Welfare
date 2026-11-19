import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateOtpCode,
  getActivationOtpExpiry,
  hashActivationOtp,
  isActivationOtpExpired,
  verifyActivationOtpHash,
} from "@/lib/activation/otp";

describe("activation otp crypto", () => {
  beforeEach(() => {
    process.env.ACTIVATION_SESSION_SECRET =
      "test-secret-with-at-least-32-characters-long";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates a 6-digit OTP", () => {
    const otp = generateOtpCode();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it("hashes OTP without storing plaintext", () => {
    const hash = hashActivationOtp("user-1", "123456");
    expect(hash).not.toContain("123456");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifies matching OTP hash", () => {
    const hash = hashActivationOtp("user-1", "123456");
    expect(verifyActivationOtpHash("user-1", "123456", hash)).toBe(true);
    expect(verifyActivationOtpHash("user-1", "000000", hash)).toBe(false);
  });

  it("expires OTP after configured minutes", () => {
    vi.useFakeTimers();
    const now = new Date("2026-06-14T12:00:00Z");
    vi.setSystemTime(now);

    const expiresAt = getActivationOtpExpiry(now);
    expect(isActivationOtpExpired(expiresAt, now)).toBe(false);

    vi.setSystemTime(new Date(expiresAt.getTime() + 1));
    expect(isActivationOtpExpired(expiresAt)).toBe(true);
  });
});
