import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  generatePhoneVerificationOtpCode,
  getPhoneVerificationOtpExpiry,
  hashPhoneVerificationOtp,
  isPhoneVerificationOtpExpired,
  verifyPhoneVerificationOtpHash,
} from "@/lib/phone-verification/otp";
import { PHONE_VERIFICATION_OTP } from "@/lib/constants/phone-verification";

describe("phone verification otp", () => {
  const originalSecret = process.env.ACTIVATION_SESSION_SECRET;

  beforeEach(() => {
    process.env.ACTIVATION_SESSION_SECRET =
      "test-secret-with-at-least-32-characters-long";
  });

  afterEach(() => {
    process.env.ACTIVATION_SESSION_SECRET = originalSecret;
  });

  it("generates a 6-digit code", () => {
    const code = generatePhoneVerificationOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("hashes and verifies OTP codes", () => {
    const verificationId = "verify-123";
    const otp = "123456";
    const hash = hashPhoneVerificationOtp(verificationId, otp);

    expect(verifyPhoneVerificationOtpHash(verificationId, otp, hash)).toBe(true);
    expect(verifyPhoneVerificationOtpHash(verificationId, "000000", hash)).toBe(false);
  });

  it("expires OTP after configured minutes", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const expiry = getPhoneVerificationOtpExpiry(now);

    expect(expiry.getTime() - now.getTime()).toBe(
      PHONE_VERIFICATION_OTP.CODE_EXPIRY_MINUTES * 60 * 1000,
    );
    expect(isPhoneVerificationOtpExpired(expiry, now)).toBe(false);
    expect(
      isPhoneVerificationOtpExpired(expiry, new Date(expiry.getTime() + 1)),
    ).toBe(true);
  });
});
