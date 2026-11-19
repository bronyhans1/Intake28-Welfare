import { describe, expect, it } from "vitest";
import {
  computePasswordResetOtpFailedAttemptUpdate,
  evaluatePasswordResetOtpRequestEligibility,
  getPasswordResetOtpCooldownRemainingSeconds,
  isPasswordResetOtpLocked,
} from "@/lib/utils/password-reset-otp";
import { ACTIVATION_OTP } from "@/lib/constants/activation-otp";

describe("password-reset OTP utils", () => {
  it("enforces cooldown between OTP sends", () => {
    const now = new Date("2026-06-14T12:00:00Z");
    const lastSent = new Date(now.getTime() - 30_000);

    const eligibility = evaluatePasswordResetOtpRequestEligibility(
      {
        passwordResetLastOtpSentAt: lastSent,
        passwordResetLockedUntil: null,
        passwordResetOtpAttempts: 0,
      },
      now,
    );

    expect(eligibility.canRequest).toBe(false);
    expect(eligibility.reason).toBe("cooldown");
    expect(eligibility.retryAfterSeconds).toBe(30);
  });

  it("locks after max failed attempts", () => {
    const now = new Date("2026-06-14T12:00:00Z");
    const update = computePasswordResetOtpFailedAttemptUpdate(
      ACTIVATION_OTP.MAX_FAILED_ATTEMPTS - 1,
      now,
    );

    expect(update.isLocked).toBe(true);
    expect(update.passwordResetOtpAttempts).toBe(
      ACTIVATION_OTP.MAX_FAILED_ATTEMPTS,
    );
    expect(update.passwordResetLockedUntil).toBeInstanceOf(Date);
  });

  it("detects active lockout", () => {
    const now = new Date("2026-06-14T12:00:00Z");
    const lockedUntil = new Date(now.getTime() + 60_000);

    expect(isPasswordResetOtpLocked(lockedUntil, now)).toBe(true);
  });

  it("returns zero cooldown when no prior send", () => {
    expect(getPasswordResetOtpCooldownRemainingSeconds(null)).toBe(0);
  });
});
