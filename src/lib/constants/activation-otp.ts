/**
 * Activation OTP rate-limiting constants.
 * Enforcement logic lives in src/lib/utils/activation-otp.ts
 */

export const ACTIVATION_OTP = {
  /** Minimum seconds between OTP send requests */
  COOLDOWN_SECONDS: 60,
  /** Failed verification attempts before lockout */
  MAX_FAILED_ATTEMPTS: 5,
  /** Lockout duration in minutes after max failed attempts */
  LOCKOUT_MINUTES: 15,
  /** OTP code validity in minutes */
  CODE_EXPIRY_MINUTES: 10,
} as const;

export const ACTIVATION_OTP_DEFAULTS = {
  lastOtpSentAt: null,
  otpAttempts: 0,
  otpLockedUntil: null,
  activationOtpSentCount: 0,
} as const;
