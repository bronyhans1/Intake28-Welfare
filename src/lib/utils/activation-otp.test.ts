import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivationStatus } from "@/types/enums";
import {
  computeOtpFailedAttemptUpdate,
  computeOtpSentUpdate,
  computeOtpSuccessReset,
  evaluateOtpRequestEligibility,
  getOtpCooldownRemainingSeconds,
  isOtpCooldownActive,
} from "@/lib/utils/activation-otp";

describe("activation-otp utilities", () => {
  const now = new Date("2026-06-14T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  it("enforces 60-second resend cooldown", () => {
    const sentAt = new Date("2026-06-14T12:00:00Z");
    expect(isOtpCooldownActive(sentAt, now)).toBe(true);
    expect(getOtpCooldownRemainingSeconds(sentAt, now)).toBe(60);

    vi.setSystemTime(new Date("2026-06-14T12:01:01Z"));
    expect(isOtpCooldownActive(sentAt, new Date())).toBe(false);
  });

  it("locks after 5 failed attempts", () => {
    const fourthFailure = computeOtpFailedAttemptUpdate(3, now);
    expect(fourthFailure.isLocked).toBe(false);

    const fifthFailure = computeOtpFailedAttemptUpdate(4, now);
    expect(fifthFailure.isLocked).toBe(true);
    expect(fifthFailure.otpAttempts).toBe(5);
    expect(fifthFailure.otpLockedUntil?.getTime()).toBe(
      now.getTime() + 15 * 60 * 1000,
    );
  });

  it("resets attempts on success", () => {
    expect(computeOtpSuccessReset()).toEqual({
      otpAttempts: 0,
      otpLockedUntil: null,
    });
  });

  it("increments sent count and timestamps on OTP send", () => {
    const update = computeOtpSentUpdate(2, now);
    expect(update.activationOtpSentCount).toBe(3);
    expect(update.lastOtpSentAt).toEqual(now);
  });

  it("treats invalid sent counts as zero before incrementing", () => {
    const update = computeOtpSentUpdate(Number.NaN, now);
    expect(update.activationOtpSentCount).toBe(1);
  });

  it("blocks OTP requests while locked or in cooldown", () => {
    const locked = evaluateOtpRequestEligibility(
      {
        activationStatus: ActivationStatus.PENDING,
        lastOtpSentAt: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        otpLockedUntil: new Date("2026-06-14T12:15:00Z") as any,
      },
      now,
    );
    expect(locked.canRequest).toBe(false);
    expect(locked.reason).toBe("locked");

    const cooldown = evaluateOtpRequestEligibility(
      {
        activationStatus: ActivationStatus.PENDING,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lastOtpSentAt: new Date("2026-06-14T12:00:00Z") as any,
        otpLockedUntil: null,
      },
      now,
    );
    expect(cooldown.canRequest).toBe(false);
    expect(cooldown.reason).toBe("cooldown");
  });
});
