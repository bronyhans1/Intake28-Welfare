import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivationStatus, UserStatus } from "@/types/enums";
import type { User } from "@/types/user";
import { PASSWORD_RESET_GENERIC_MESSAGE } from "@/lib/constants/password-reset";
import { PasswordResetAuditAction } from "@/lib/password-reset/audit";
import {
  hashPasswordResetOtp,
  getPasswordResetOtpExpiry,
} from "@/lib/password-reset/otp";

const mockFindUserByServiceNumber = vi.fn();
const mockFindUserById = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockUpdateUser = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDoc = vi.fn();

vi.mock("@/lib/activation/repository", () => ({
  findUserByServiceNumber: (...args: unknown[]) =>
    mockFindUserByServiceNumber(...args),
  findUserById: (...args: unknown[]) => mockFindUserById(...args),
}));

vi.mock("@/lib/audit/repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => ({ updateUser: mockUpdateUser }),
  getAdminDb: () => ({
    collection: () => ({
      doc: (...args: unknown[]) => mockDbDoc(...args),
    }),
  }),
}));

import {
  requestPasswordReset,
  resetPassword,
} from "@/lib/password-reset/repository";

const activatedUser: User = {
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
  isDefaulter: false,
  consecutiveUnpaidMonths: 0,
  createdAt: { seconds: 0, nanoseconds: 0 } as User["createdAt"],
  updatedAt: { seconds: 0, nanoseconds: 0 } as User["updatedAt"],
};

const validInput = {
  serviceNumberSuffix: "13984",
  phoneNumber: "0241234567",
};

describe("requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUserByServiceNumber.mockResolvedValue(activatedUser);
  });

  it("returns generic success without context when user not found", async () => {
    mockFindUserByServiceNumber.mockResolvedValue(null);

    const result = await requestPasswordReset(validInput);

    expect(result).toEqual({
      success: true,
      matched: false,
      message: PASSWORD_RESET_GENERIC_MESSAGE,
    });
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it("returns generic success without context when user is not eligible", async () => {
    mockFindUserByServiceNumber.mockResolvedValue({
      ...activatedUser,
      activationStatus: ActivationStatus.PENDING,
    });

    const result = await requestPasswordReset(validInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.matched).toBe(false);
      expect(result.message).toBe(PASSWORD_RESET_GENERIC_MESSAGE);
    }
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it("returns context and creates audit log when details match", async () => {
    const result = await requestPasswordReset(validInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.matched).toBe(true);
      expect(result.context).toEqual({
        userId: "user-1",
        serviceNumber: "IS/13984",
        phoneNumber: "0241234567",
        step: "otp",
      });
    }
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PasswordResetAuditAction.PASSWORD_RESET_REQUESTED,
        entityId: "user-1",
        actorId: "user-1",
        actorName: "John Doe",
      }),
    );
  });

  it("returns validation errors for invalid input", async () => {
    const result = await requestPasswordReset({
      serviceNumberSuffix: "",
      phoneNumber: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("resetPassword", () => {
  const context = {
    userId: "user-1",
    serviceNumber: "IS/13984",
    phoneNumber: "0241234567",
    step: "reset" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUserById.mockResolvedValue(activatedUser);
    mockUpdateUser.mockResolvedValue(undefined);
    mockDbDoc.mockReturnValue({ update: mockDbUpdate });
    mockDbUpdate.mockResolvedValue(undefined);
  });

  it("updates Firebase password and creates audit log", async () => {
    await resetPassword(context, "NewPass123");

    expect(mockUpdateUser).toHaveBeenCalledWith("user-1", {
      password: "NewPass123",
    });
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PasswordResetAuditAction.PASSWORD_RESET_COMPLETED,
        entityId: "user-1",
        actorId: "user-1",
        actorName: "John Doe",
      }),
    );
  });
});

describe("password reset OTP hash", () => {
  it("hashes OTP consistently", () => {
    const hash = hashPasswordResetOtp("user-1", "123456");
    expect(hash).toHaveLength(64);
    expect(getPasswordResetOtpExpiry()).toBeInstanceOf(Date);
  });
});
