import {
  ACTIVATION_OTP,
  ACTIVATION_OTP_DEFAULTS,
} from "@/lib/constants/activation-otp";
import { safeNumber } from "@/lib/firestore/safe-number";
import { ActivationStatus } from "@/types/enums";
import type {
  OtpFailedAttemptResult,
  OtpRequestEligibility,
  OtpSentUpdate,
  OtpSuccessReset,
  OtpTrackingFields,
} from "@/types/activation-otp";

type TimestampLike =
  | Date
  | { toMillis(): number }
  | { seconds: number; nanoseconds?: number };

function toMillis(value: TimestampLike | null | undefined): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if ("toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  if ("seconds" in value) {
    return value.seconds * 1000;
  }
  return null;
}

/** Default OTP tracking values for new or reset user documents */
export function getDefaultOtpTrackingFields(): OtpTrackingFields {
  return { ...ACTIVATION_OTP_DEFAULTS };
}

/** Whether the user is currently within the 60-second OTP send cooldown */
export function isOtpCooldownActive(
  lastOtpSentAt: TimestampLike | null | undefined,
  now: Date = new Date(),
): boolean {
  const sentAt = toMillis(lastOtpSentAt);
  if (sentAt == null) return false;
  const elapsedMs = now.getTime() - sentAt;
  return elapsedMs < ACTIVATION_OTP.COOLDOWN_SECONDS * 1000;
}

/** Seconds remaining in cooldown — 0 if cooldown has expired */
export function getOtpCooldownRemainingSeconds(
  lastOtpSentAt: TimestampLike | null | undefined,
  now: Date = new Date(),
): number {
  const sentAt = toMillis(lastOtpSentAt);
  if (sentAt == null) return 0;
  const elapsedMs = now.getTime() - sentAt;
  const cooldownMs = ACTIVATION_OTP.COOLDOWN_SECONDS * 1000;
  const remainingMs = cooldownMs - elapsedMs;
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

/** Whether OTP requests are locked due to too many failed verification attempts */
export function isOtpLocked(
  otpLockedUntil: TimestampLike | null | undefined,
  now: Date = new Date(),
): boolean {
  const lockedUntil = toMillis(otpLockedUntil);
  if (lockedUntil == null) return false;
  return now.getTime() < lockedUntil;
}

/** Computes lockout expiry: now + 15 minutes */
export function computeOtpLockoutUntil(now: Date = new Date()): Date {
  return new Date(
    now.getTime() + ACTIVATION_OTP.LOCKOUT_MINUTES * 60 * 1000,
  );
}

/**
 * Determines whether an OTP send request is permitted.
 * Checks: activation status, lockout, and cooldown (in that order).
 */
export function evaluateOtpRequestEligibility(
  input: Pick<OtpTrackingFields, "lastOtpSentAt" | "otpLockedUntil"> & {
    activationStatus: ActivationStatus;
  },
  now: Date = new Date(),
): OtpRequestEligibility {
  if (input.activationStatus === ActivationStatus.ACTIVATED) {
    return { canRequest: false, reason: "already_activated" };
  }

  if (isOtpLocked(input.otpLockedUntil, now)) {
    const lockedUntilMs = toMillis(input.otpLockedUntil);
    return {
      canRequest: false,
      reason: "locked",
      lockedUntil: lockedUntilMs != null ? new Date(lockedUntilMs) : undefined,
    };
  }

  if (isOtpCooldownActive(input.lastOtpSentAt, now)) {
    return {
      canRequest: false,
      reason: "cooldown",
      retryAfterSeconds: getOtpCooldownRemainingSeconds(
        input.lastOtpSentAt,
        now,
      ),
    };
  }

  return { canRequest: true };
}

/**
 * Returns field updates after a failed OTP verification.
 * Increments otpAttempts; applies lockout when attempts reach 5.
 */
export function computeOtpFailedAttemptUpdate(
  currentAttempts: number,
  now: Date = new Date(),
): OtpFailedAttemptResult {
  const otpAttempts = currentAttempts + 1;
  const isLocked = otpAttempts >= ACTIVATION_OTP.MAX_FAILED_ATTEMPTS;

  return {
    otpAttempts,
    otpLockedUntil: isLocked ? computeOtpLockoutUntil(now) : null,
    isLocked,
  };
}

/** Returns field updates after successful OTP verification */
export function computeOtpSuccessReset(): OtpSuccessReset {
  return {
    otpAttempts: 0,
    otpLockedUntil: null,
  };
}

/** Returns field updates after a successful OTP send via Hubtel */
export function computeOtpSentUpdate(
  currentSentCount: number,
  now: Date = new Date(),
): OtpSentUpdate {
  return {
    lastOtpSentAt: now,
    activationOtpSentCount: safeNumber(currentSentCount, 0) + 1,
  };
}
