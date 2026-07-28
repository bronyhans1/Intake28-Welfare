import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { ACTIVATION_OTP } from "@/lib/constants/activation-otp";

function getOtpPepper(): string {
  const secret = process.env.ACTIVATION_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "ACTIVATION_SESSION_SECRET must be set with at least 32 characters.",
    );
  }
  return secret;
}

/** Generates a cryptographically random 6-digit OTP */
export function generatePasswordResetOtpCode(): string {
  return String(randomInt(100000, 1000000));
}

export function hashPasswordResetOtp(userId: string, otp: string): string {
  return createHmac("sha256", getOtpPepper())
    .update(`reset:${userId}:${otp}`)
    .digest("hex");
}

export function getPasswordResetOtpExpiry(now: Date = new Date()): Date {
  return new Date(
    now.getTime() + ACTIVATION_OTP.CODE_EXPIRY_MINUTES * 60 * 1000,
  );
}

export function isPasswordResetOtpExpired(
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) {
    return true;
  }
  return now.getTime() >= expiresAt.getTime();
}

export function verifyPasswordResetOtpHash(
  userId: string,
  otp: string,
  storedHash: string | null | undefined,
): boolean {
  if (!storedHash) {
    return false;
  }

  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashPasswordResetOtp(userId, otp), "hex");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}
