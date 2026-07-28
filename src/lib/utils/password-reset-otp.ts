import {
  ACTIVATION_OTP,
  ACTIVATION_OTP_DEFAULTS,
} from "@/lib/constants/activation-otp";
import { safeNumber } from "@/lib/firestore/safe-number";

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

export interface PasswordResetOtpTrackingFields {
  passwordResetLastOtpSentAt: TimestampLike | null;
  passwordResetLockedUntil: TimestampLike | null;
  passwordResetOtpAttempts: number;
}

export interface PasswordResetOtpRequestEligibility {
  canRequest: boolean;
  reason?: "locked" | "cooldown";
  retryAfterSeconds?: number;
  lockedUntil?: Date;
}

export interface PasswordResetOtpFailedAttemptResult {
  passwordResetOtpAttempts: number;
  passwordResetLockedUntil: Date | null;
  isLocked: boolean;
}

export interface PasswordResetOtpSuccessReset {
  passwordResetOtpAttempts: number;
  passwordResetLockedUntil: null;
  passwordResetOtp: null;
  passwordResetOtpExpiresAt: null;
}

export function getDefaultPasswordResetOtpFields() {
  return {
    passwordResetOtp: null,
    passwordResetOtpExpiresAt: null,
    passwordResetOtpAttempts: 0,
    passwordResetRequestedAt: null,
    passwordResetLockedUntil: null,
    passwordResetLastOtpSentAt: null,
  };
}

export function isPasswordResetOtpCooldownActive(
  passwordResetLastOtpSentAt: TimestampLike | null | undefined,
  now: Date = new Date(),
): boolean {
  const sentAt = toMillis(passwordResetLastOtpSentAt);
  if (sentAt == null) return false;
  const elapsedMs = now.getTime() - sentAt;
  return elapsedMs < ACTIVATION_OTP.COOLDOWN_SECONDS * 1000;
}

export function getPasswordResetOtpCooldownRemainingSeconds(
  passwordResetLastOtpSentAt: TimestampLike | null | undefined,
  now: Date = new Date(),
): number {
  const sentAt = toMillis(passwordResetLastOtpSentAt);
  if (sentAt == null) return 0;
  const elapsedMs = now.getTime() - sentAt;
  const cooldownMs = ACTIVATION_OTP.COOLDOWN_SECONDS * 1000;
  const remainingMs = cooldownMs - elapsedMs;
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

export function isPasswordResetOtpLocked(
  passwordResetLockedUntil: TimestampLike | null | undefined,
  now: Date = new Date(),
): boolean {
  const lockedUntil = toMillis(passwordResetLockedUntil);
  if (lockedUntil == null) return false;
  return now.getTime() < lockedUntil;
}

export function computePasswordResetOtpLockoutUntil(
  now: Date = new Date(),
): Date {
  return new Date(
    now.getTime() + ACTIVATION_OTP.LOCKOUT_MINUTES * 60 * 1000,
  );
}

export function evaluatePasswordResetOtpRequestEligibility(
  input: PasswordResetOtpTrackingFields,
  now: Date = new Date(),
): PasswordResetOtpRequestEligibility {
  if (isPasswordResetOtpLocked(input.passwordResetLockedUntil, now)) {
    const lockedUntilMs = toMillis(input.passwordResetLockedUntil);
    return {
      canRequest: false,
      reason: "locked",
      lockedUntil:
        lockedUntilMs != null ? new Date(lockedUntilMs) : undefined,
    };
  }

  if (isPasswordResetOtpCooldownActive(input.passwordResetLastOtpSentAt, now)) {
    return {
      canRequest: false,
      reason: "cooldown",
      retryAfterSeconds: getPasswordResetOtpCooldownRemainingSeconds(
        input.passwordResetLastOtpSentAt,
        now,
      ),
    };
  }

  return { canRequest: true };
}

export function computePasswordResetOtpFailedAttemptUpdate(
  currentAttempts: number,
  now: Date = new Date(),
): PasswordResetOtpFailedAttemptResult {
  const passwordResetOtpAttempts = currentAttempts + 1;
  const isLocked =
    passwordResetOtpAttempts >= ACTIVATION_OTP.MAX_FAILED_ATTEMPTS;

  return {
    passwordResetOtpAttempts,
    passwordResetLockedUntil: isLocked
      ? computePasswordResetOtpLockoutUntil(now)
      : null,
    isLocked,
  };
}

export function computePasswordResetOtpSuccessReset(): PasswordResetOtpSuccessReset {
  return {
    passwordResetOtpAttempts: 0,
    passwordResetLockedUntil: null,
    passwordResetOtp: null,
    passwordResetOtpExpiresAt: null,
  };
}

export function computePasswordResetOtpSentUpdate(
  now: Date = new Date(),
): {
  passwordResetLastOtpSentAt: Date;
  passwordResetRequestedAt: Date;
} {
  return {
    passwordResetLastOtpSentAt: now,
    passwordResetRequestedAt: now,
  };
}

export function toPasswordResetOtpTrackingFields(
  user: Partial<PasswordResetOtpTrackingFields>,
): PasswordResetOtpTrackingFields {
  return {
    passwordResetLastOtpSentAt:
      user.passwordResetLastOtpSentAt ??
      ACTIVATION_OTP_DEFAULTS.lastOtpSentAt,
    passwordResetLockedUntil:
      user.passwordResetLockedUntil ?? ACTIVATION_OTP_DEFAULTS.otpLockedUntil,
    passwordResetOtpAttempts: safeNumber(user.passwordResetOtpAttempts, 0),
  };
}

function toDate(value: TimestampLike | null | undefined): Date | undefined {
  const ms = toMillis(value);
  return ms != null ? new Date(ms) : undefined;
}

export function toPasswordResetOtpExpiresDate(
  value: TimestampLike | null | undefined,
): Date | null {
  return toDate(value) ?? null;
}
