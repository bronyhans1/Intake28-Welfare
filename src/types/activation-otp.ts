import type { Timestamp } from "firebase/firestore";

/** OTP tracking fields stored on the users document during activation */
export interface OtpTrackingFields {
  /** Timestamp of the most recent OTP send — enforces 60s cooldown */
  lastOtpSentAt: Timestamp | null;
  /** Consecutive failed OTP verification attempts — default 0 */
  otpAttempts: number;
  /** Lockout expiry — set after 5 failed attempts (now + 15 minutes) */
  otpLockedUntil: Timestamp | null;
  /** Lifetime count of OTPs sent during activation — audit and abuse detection */
  activationOtpSentCount: number;
}

export type OtpRequestBlockReason =
  | "already_activated"
  | "locked"
  | "cooldown";

export interface OtpRequestEligibility {
  canRequest: boolean;
  reason?: OtpRequestBlockReason;
  /** Seconds until cooldown expires — present when reason is "cooldown" */
  retryAfterSeconds?: number;
  /** Lockout expiry — present when reason is "locked" */
  lockedUntil?: Date;
}

export interface OtpFailedAttemptResult {
  otpAttempts: number;
  otpLockedUntil: Date | null;
  isLocked: boolean;
}

export interface OtpSuccessReset {
  otpAttempts: 0;
  otpLockedUntil: null;
}

export interface OtpSentUpdate {
  lastOtpSentAt: Date;
  activationOtpSentCount: number;
}
