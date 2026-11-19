import { findUserById, updateUserOtpTracking } from "@/lib/activation/repository";
import {
  generateOtpCode,
  getActivationOtpExpiry,
  hashActivationOtp,
  isActivationOtpExpired,
  verifyActivationOtpHash,
} from "@/lib/activation/otp";
import type { User } from "@/types/user";

export { generateOtpCode };

type TimestampLike =
  | Date
  | { toMillis(): number }
  | { seconds: number; nanoseconds?: number };

function toExpiresDate(
  value: TimestampLike | null | undefined,
): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if ("toMillis" in value && typeof value.toMillis === "function") {
    return new Date(value.toMillis());
  }
  if ("seconds" in value) {
    return new Date(value.seconds * 1000);
  }
  return null;
}

function readActivationOtpFields(
  user: Pick<User, "activationOtp" | "activationOtpExpiresAt">,
) {
  return {
    hash: user.activationOtp ?? null,
    expiresAt: toExpiresDate(user.activationOtpExpiresAt),
  };
}

/** Persists a hashed activation OTP on the member record (Firestore). */
export async function storeOtpCode(
  userId: string,
  otp: string,
  now: Date = new Date(),
): Promise<void> {
  await updateUserOtpTracking(userId, {
    activationOtp: hashActivationOtp(userId, otp),
    activationOtpExpiresAt: getActivationOtpExpiry(now),
  });
}

export async function hasActiveOtpCode(
  userId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const user = await findUserById(userId);
  if (!user?.activationOtp) {
    return false;
  }

  const { hash, expiresAt } = readActivationOtpFields(user);
  if (!hash) {
    return false;
  }

  return !isActivationOtpExpired(expiresAt, now);
}

export async function verifyOtpCode(
  userId: string,
  otp: string,
  now: Date = new Date(),
): Promise<boolean> {
  const user = await findUserById(userId);
  if (!user) {
    return false;
  }

  const { hash, expiresAt } = readActivationOtpFields(user);
  if (!hash) {
    return false;
  }

  if (isActivationOtpExpired(expiresAt, now)) {
    await clearOtpCode(userId);
    return false;
  }

  const isValid = verifyActivationOtpHash(userId, otp, hash);
  if (isValid) {
    await clearOtpCode(userId);
  }

  return isValid;
}

export async function clearOtpCode(userId: string): Promise<void> {
  await updateUserOtpTracking(userId, {
    activationOtp: null,
    activationOtpExpiresAt: null,
  });
}
