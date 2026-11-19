import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { PHONE_VERIFICATION_OTP } from "@/lib/constants/phone-verification";

function getOtpPepper(): string {
  const secret = process.env.ACTIVATION_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "ACTIVATION_SESSION_SECRET must be set with at least 32 characters.",
    );
  }
  return secret;
}

export function generatePhoneVerificationOtpCode(): string {
  return String(randomInt(100000, 1000000));
}

export function hashPhoneVerificationOtp(
  verificationId: string,
  otp: string,
): string {
  return createHmac("sha256", getOtpPepper())
    .update(`phone-verify:${verificationId}:${otp}`)
    .digest("hex");
}

export function getPhoneVerificationOtpExpiry(now: Date = new Date()): Date {
  return new Date(
    now.getTime() + PHONE_VERIFICATION_OTP.CODE_EXPIRY_MINUTES * 60 * 1000,
  );
}

export function isPhoneVerificationOtpExpired(
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) {
    return true;
  }
  return now.getTime() >= expiresAt.getTime();
}

export function verifyPhoneVerificationOtpHash(
  verificationId: string,
  otp: string,
  storedHash: string | null | undefined,
): boolean {
  if (!storedHash) {
    return false;
  }

  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashPhoneVerificationOtp(verificationId, otp), "hex");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}
