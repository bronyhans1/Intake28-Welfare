import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivationStatus } from "@/types/enums";
import { UserStatus } from "@/types/enums";
import type { User } from "@/types/user";
import { ACTIVATION_OTP } from "@/lib/constants/activation-otp";

const mockFindUserById = vi.fn();
const mockUpdateUserOtpTracking = vi.fn();
const mockUpdateActivationContext = vi.fn();
const mockSendOtpSms = vi.fn();
const mockStoreOtpCode = vi.fn();
const mockVerifyOtpCode = vi.fn();
const mockClearOtpCode = vi.fn();
const mockHasActiveOtpCode = vi.fn();

vi.mock("@/lib/activation/repository", () => ({
  findUserById: (...args: unknown[]) => mockFindUserById(...args),
  updateUserOtpTracking: (...args: unknown[]) =>
    mockUpdateUserOtpTracking(...args),
}));

vi.mock("@/lib/activation/session", () => ({
  updateActivationContext: (...args: unknown[]) =>
    mockUpdateActivationContext(...args),
}));

vi.mock("@/lib/notifications/otp-sms", () => ({
  sendOtpSms: (...args: unknown[]) => mockSendOtpSms(...args),
}));

vi.mock("@/lib/activation/otp-store", () => ({
  generateOtpCode: () => "123456",
  storeOtpCode: (...args: unknown[]) => mockStoreOtpCode(...args),
  verifyOtpCode: (...args: unknown[]) => mockVerifyOtpCode(...args),
  clearOtpCode: (...args: unknown[]) => mockClearOtpCode(...args),
  hasActiveOtpCode: (...args: unknown[]) => mockHasActiveOtpCode(...args),
}));

import {
  sendActivationOtp,
  verifyActivationOtp,
} from "@/lib/activation/otp-service";

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
  profileCompleted: false,
  profileCompletionPercentage: 0,
  role: "member",
  status: UserStatus.ACTIVE,
  activationStatus: ActivationStatus.PENDING,
  lastOtpSentAt: null,
  otpAttempts: 0,
  otpLockedUntil: null,
  activationOtpSentCount: 0,
  isDefaulter: false,
  consecutiveUnpaidMonths: 0,
  createdAt: { seconds: 0, nanoseconds: 0 } as User["createdAt"],
  updatedAt: { seconds: 0, nanoseconds: 0 } as User["updatedAt"],
};

describe("activation OTP service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUserById.mockResolvedValue(baseUser);
    mockUpdateUserOtpTracking.mockResolvedValue(undefined);
    mockUpdateActivationContext.mockResolvedValue(undefined);
    mockStoreOtpCode.mockResolvedValue(undefined);
    mockClearOtpCode.mockResolvedValue(undefined);
    mockHasActiveOtpCode.mockResolvedValue(false);
    mockSendOtpSms.mockResolvedValue({
      sent: true,
      provider: "development",
      message: "Verification code sent.",
    });
    mockVerifyOtpCode.mockResolvedValue(true);
  });

  it("stores OTP and sends SMS via sendOtpSms", async () => {
    const result = await sendActivationOtp(context);

    expect(result.sent).toBe(true);
    expect(mockStoreOtpCode).toHaveBeenCalledWith("user-1", "123456", expect.any(Date));
    expect(mockSendOtpSms).toHaveBeenCalledWith(
      "0241234567",
      "123456",
      expect.objectContaining({
        memberId: "user-1",
        serviceNumber: "IS/13984",
        purpose: "activation",
      }),
    );
  });

  it("returns failure when SMS send fails", async () => {
    mockSendOtpSms.mockResolvedValue({
      sent: false,
      provider: "hubtel",
      message: "Unable to send verification code. Please try again later.",
    });

    const result = await sendActivationOtp(context);

    expect(result.sent).toBe(false);
    expect(result.message).toContain("Unable to send");
  });

  it("verifies a valid OTP and advances the session", async () => {
    const result = await verifyActivationOtp(context, "123456");

    expect(result.success).toBe(true);
    expect(mockUpdateUserOtpTracking).toHaveBeenCalledWith("user-1", {
      otpAttempts: 0,
      otpLockedUntil: null,
    });
    expect(mockUpdateActivationContext).toHaveBeenCalledWith({
      ...context,
      step: "password",
    });
  });

  it("increments failed attempts for invalid OTP", async () => {
    mockVerifyOtpCode.mockResolvedValue(false);

    const result = await verifyActivationOtp(context, "000000");

    expect(result.success).toBe(false);
    expect(mockUpdateUserOtpTracking).toHaveBeenCalledWith("user-1", {
      otpAttempts: 1,
      otpLockedUntil: null,
    });
  });

  it("locks out and clears OTP after max failed attempts", async () => {
    mockVerifyOtpCode.mockResolvedValue(false);
    mockFindUserById.mockResolvedValue({
      ...baseUser,
      otpAttempts: ACTIVATION_OTP.MAX_FAILED_ATTEMPTS - 1,
    });

    const result = await verifyActivationOtp(context, "000000");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.isLocked).toBe(true);
    }
    expect(mockClearOtpCode).toHaveBeenCalledWith("user-1");
  });
});
