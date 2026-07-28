import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivationStatus } from "@/types/enums";
import { UserStatus } from "@/types/enums";
import type { User } from "@/types/user";
import {
  resetOtpStoreForTests,
  storeOtpCode,
} from "@/lib/activation/otp-store";

const mockFindUserById = vi.fn();
const mockUpdateUserOtpTracking = vi.fn();
const mockUpdateActivationContext = vi.fn();

vi.mock("@/lib/activation/repository", () => ({
  findUserById: (...args: unknown[]) => mockFindUserById(...args),
  updateUserOtpTracking: (...args: unknown[]) =>
    mockUpdateUserOtpTracking(...args),
}));

vi.mock("@/lib/activation/session", () => ({
  updateActivationContext: (...args: unknown[]) =>
    mockUpdateActivationContext(...args),
}));

import { verifyActivationOtp } from "@/lib/activation/otp-service";

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

describe("verifyActivationOtp", () => {
  beforeEach(() => {
    resetOtpStoreForTests();
    vi.clearAllMocks();
    mockFindUserById.mockResolvedValue(baseUser);
    mockUpdateUserOtpTracking.mockResolvedValue(undefined);
    mockUpdateActivationContext.mockResolvedValue(undefined);
    storeOtpCode("user-1", "123456");
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
    const result = await verifyActivationOtp(context, "000000");

    expect(result.success).toBe(false);
    expect(mockUpdateUserOtpTracking).toHaveBeenCalledWith("user-1", {
      otpAttempts: 1,
      otpLockedUntil: null,
    });
  });
});
