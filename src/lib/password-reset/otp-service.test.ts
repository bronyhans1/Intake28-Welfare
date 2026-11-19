import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivationStatus, UserStatus } from "@/types/enums";
import type { User } from "@/types/user";
import {
  hashPasswordResetOtp,
  getPasswordResetOtpExpiry,
} from "@/lib/password-reset/otp";
import { ACTIVATION_OTP } from "@/lib/constants/activation-otp";

const mockFindUserById = vi.fn();
const mockUpdatePasswordResetOtpTracking = vi.fn();
const mockUpdatePasswordResetContext = vi.fn();
const mockSendOtpSms = vi.fn();

vi.mock("@/lib/activation/repository", () => ({
  findUserById: (...args: unknown[]) => mockFindUserById(...args),
}));

vi.mock("@/lib/password-reset/repository", () => ({
  updatePasswordResetOtpTracking: (...args: unknown[]) =>
    mockUpdatePasswordResetOtpTracking(...args),
}));

vi.mock("@/lib/password-reset/session", () => ({
  updatePasswordResetContext: (...args: unknown[]) =>
    mockUpdatePasswordResetContext(...args),
}));

vi.mock("@/lib/notifications/otp-sms", () => ({
  sendOtpSms: (...args: unknown[]) => mockSendOtpSms(...args),
}));

import {
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
} from "@/lib/password-reset/otp-service";

const context = {
  userId: "user-1",
  serviceNumber: "IS/13984",
  phoneNumber: "0241234567",
  step: "otp" as const,
};

const baseUser: User = {
  id: "user-1",
  serviceNumber: "IS/13984",
  serviceNumberSuffix: "13984",
  fullName: "John Doe",
  phoneNumber: "0241234567",
  rank: "Inspector",
  station: "HQ",
  profileCompleted: true,
  profileCompletionPercentage: 100,
  role: "member",
  status: UserStatus.ACTIVE,
  activationStatus: ActivationStatus.ACTIVATED,
  lastOtpSentAt: null,
  otpAttempts: 0,
  otpLockedUntil: null,
  activationOtpSentCount: 0,
  passwordResetOtpAttempts: 0,
  passwordResetLockedUntil: null,
  passwordResetLastOtpSentAt: null,
  isDefaulter: false,
  consecutiveUnpaidMonths: 0,
  createdAt: { seconds: 0, nanoseconds: 0 } as User["createdAt"],
  updatedAt: { seconds: 0, nanoseconds: 0 } as User["updatedAt"],
};

describe("password reset OTP service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUserById.mockResolvedValue(baseUser);
    mockUpdatePasswordResetOtpTracking.mockResolvedValue(undefined);
    mockUpdatePasswordResetContext.mockResolvedValue(undefined);
    mockSendOtpSms.mockResolvedValue({
      sent: true,
      provider: "development",
      message: "Verification code sent.",
    });
  });

  it("sends OTP, stores hashed code, and calls sendOtpSms", async () => {
    const result = await sendPasswordResetOtp(context);

    expect(result.sent).toBe(true);
    expect(mockUpdatePasswordResetOtpTracking).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        passwordResetOtp: expect.any(String),
        passwordResetOtpExpiresAt: expect.any(Date),
      }),
    );

    const storedHash = mockUpdatePasswordResetOtpTracking.mock.calls[0][1]
      .passwordResetOtp as string;
    expect(storedHash).not.toBe("123456");

    expect(mockSendOtpSms).toHaveBeenCalledWith(
      "0241234567",
      expect.any(String),
      expect.objectContaining({
        memberId: "user-1",
        purpose: "password_reset",
      }),
    );
  });

  it("returns failure when SMS send fails", async () => {
    mockSendOtpSms.mockResolvedValue({
      sent: false,
      provider: "hubtel",
      message: "Unable to send verification code. Please try again later.",
    });

    const result = await sendPasswordResetOtp(context);
    expect(result.sent).toBe(false);
  });

  it("verifies a valid OTP and advances the session", async () => {
    const otp = "123456";
    const expiresAt = getPasswordResetOtpExpiry();

    mockFindUserById.mockResolvedValue({
      ...baseUser,
      passwordResetOtp: hashPasswordResetOtp("user-1", otp),
      passwordResetOtpExpiresAt: expiresAt,
    });

    const result = await verifyPasswordResetOtp(context, otp);

    expect(result.success).toBe(true);
    expect(mockUpdatePasswordResetContext).toHaveBeenCalledWith({
      ...context,
      step: "reset",
    });
  });

  it("rejects an invalid OTP", async () => {
    mockFindUserById.mockResolvedValue({
      ...baseUser,
      passwordResetOtp: hashPasswordResetOtp("user-1", "123456"),
      passwordResetOtpExpiresAt: getPasswordResetOtpExpiry(),
    });

    const result = await verifyPasswordResetOtp(context, "000000");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid or expired");
    }
    expect(mockUpdatePasswordResetOtpTracking).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ passwordResetOtpAttempts: 1 }),
    );
  });

  it("rejects an expired OTP", async () => {
    const expiredAt = new Date(Date.now() - 60_000);

    mockFindUserById.mockResolvedValue({
      ...baseUser,
      passwordResetOtp: hashPasswordResetOtp("user-1", "123456"),
      passwordResetOtpExpiresAt: expiredAt,
    });

    const result = await verifyPasswordResetOtp(context, "123456");

    expect(result.success).toBe(false);
  });

  it("locks after max failed attempts", async () => {
    mockFindUserById.mockResolvedValue({
      ...baseUser,
      passwordResetOtp: hashPasswordResetOtp("user-1", "123456"),
      passwordResetOtpExpiresAt: getPasswordResetOtpExpiry(),
      passwordResetOtpAttempts: ACTIVATION_OTP.MAX_FAILED_ATTEMPTS - 1,
    });

    const result = await verifyPasswordResetOtp(context, "000000");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.isLocked).toBe(true);
    }
  });
});
