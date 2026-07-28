import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { ACTIVATION_OTP } from "@/lib/constants/activation-otp";

interface StoredOtp {
  hash: string;
  expiresAt: number;
}

const otpStore = new Map<string, StoredOtp>();

function getOtpPepper(): string {
  const secret = process.env.ACTIVATION_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "ACTIVATION_SESSION_SECRET must be set with at least 32 characters.",
    );
  }
  return secret;
}

function hashOtp(userId: string, otp: string): string {
  return createHmac("sha256", getOtpPepper())
    .update(`${userId}:${otp}`)
    .digest("hex");
}

/** Generates a cryptographically random 6-digit OTP */
export function generateOtpCode(): string {
  return String(randomInt(100000, 1000000));
}

export function getOtpExpiryMs(now: Date = new Date()): number {
  return now.getTime() + ACTIVATION_OTP.CODE_EXPIRY_MINUTES * 60 * 1000;
}

export function isOtpCodeExpired(
  expiresAt: number,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= expiresAt;
}

export function storeOtpCode(
  userId: string,
  otp: string,
  now: Date = new Date(),
): void {
  otpStore.set(userId, {
    hash: hashOtp(userId, otp),
    expiresAt: getOtpExpiryMs(now),
  });
}

export function hasActiveOtpCode(
  userId: string,
  now: Date = new Date(),
): boolean {
  const stored = otpStore.get(userId);
  if (!stored) return false;
  return !isOtpCodeExpired(stored.expiresAt, now);
}

export function verifyOtpCode(
  userId: string,
  otp: string,
  now: Date = new Date(),
): boolean {
  const stored = otpStore.get(userId);
  if (!stored) return false;
  if (isOtpCodeExpired(stored.expiresAt, now)) {
    otpStore.delete(userId);
    return false;
  }

  const expected = Buffer.from(stored.hash, "hex");
  const actual = Buffer.from(hashOtp(userId, otp), "hex");

  if (expected.length !== actual.length) return false;

  const matches = timingSafeEqual(expected, actual);
  if (matches) {
    otpStore.delete(userId);
  }
  return matches;
}

export function clearOtpCode(userId: string): void {
  otpStore.delete(userId);
}

/** @internal Test helper */
export function resetOtpStoreForTests(): void {
  otpStore.clear();
}

/** @internal Test helper */
export function getOtpStoreSizeForTests(): number {
  return otpStore.size;
}
