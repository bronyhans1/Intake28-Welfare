import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivationStatus, UserStatus } from "@/types/enums";
import type { User } from "@/types/user";

const mockCreateUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockGetUser = vi.fn();
const mockFindUserById = vi.fn();
const mockActivateUserRecord = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => ({
    createUser: mockCreateUser,
    updateUser: mockUpdateUser,
    getUser: mockGetUser,
  }),
}));

vi.mock("@/lib/activation/repository", () => ({
  findUserById: (...args: unknown[]) => mockFindUserById(...args),
  activateUserRecord: (...args: unknown[]) => mockActivateUserRecord(...args),
}));

import {
  completeMemberActivation,
  createFirebaseAuthAccount,
  disableFirebaseAuthAccountIfExists,
} from "@/lib/activation/complete";

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

describe("createFirebaseAuthAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates Auth user on first activation when UID is missing", async () => {
    mockGetUser.mockRejectedValue({ code: "auth/user-not-found" });
    mockCreateUser.mockResolvedValue({ uid: "user-1" });

    await expect(
      createFirebaseAuthAccount("user-1", "IS/13984", "Secret1a", "John Doe"),
    ).resolves.toBe("created");

    expect(mockCreateUser).toHaveBeenCalledWith({
      uid: "user-1",
      email: "IS13984@giswelfare.local",
      password: "Secret1a",
      displayName: "John Doe",
      disabled: false,
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("updates existing Auth user on re-activation after reset", async () => {
    mockGetUser.mockResolvedValue({ uid: "user-1", disabled: true });
    mockUpdateUser.mockResolvedValue({ uid: "user-1" });

    await expect(
      createFirebaseAuthAccount("user-1", "IS/13984", "NewSecret1a", "John Doe"),
    ).resolves.toBe("updated");

    expect(mockUpdateUser).toHaveBeenCalledWith("user-1", {
      email: "IS13984@giswelfare.local",
      password: "NewSecret1a",
      displayName: "John Doe",
      disabled: false,
    });
    expect(mockCreateUser).not.toHaveBeenCalled();
  });
});

describe("disableFirebaseAuthAccountIfExists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disables an existing Auth user", async () => {
    mockGetUser.mockResolvedValue({ uid: "user-1" });
    mockUpdateUser.mockResolvedValue({ uid: "user-1", disabled: true });

    await expect(disableFirebaseAuthAccountIfExists("user-1")).resolves.toBe(
      true,
    );
    expect(mockUpdateUser).toHaveBeenCalledWith("user-1", { disabled: true });
  });

  it("ignores missing Auth users without throwing", async () => {
    mockGetUser.mockRejectedValue({ code: "auth/user-not-found" });

    await expect(disableFirebaseAuthAccountIfExists("user-1")).resolves.toBe(
      false,
    );
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});

describe("completeMemberActivation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUserById.mockResolvedValue(baseUser);
    mockGetUser.mockRejectedValue({ code: "auth/user-not-found" });
    mockCreateUser.mockResolvedValue({ uid: "user-1" });
    mockActivateUserRecord.mockResolvedValue(undefined);
  });

  it("creates Firebase Auth user and updates Firestore activation fields", async () => {
    await completeMemberActivation("user-1", "Secret1a");

    expect(mockCreateUser).toHaveBeenCalledWith({
      uid: "user-1",
      email: "IS13984@giswelfare.local",
      password: "Secret1a",
      displayName: "John Doe",
      disabled: false,
    });

    expect(mockActivateUserRecord).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        profileCompleted: expect.any(Boolean),
        profileCompletionPercentage: expect.any(Number),
      }),
    );
  });

  it("reuses existing Auth UID on activation after reset", async () => {
    mockGetUser.mockResolvedValue({ uid: "user-1", disabled: true });
    mockUpdateUser.mockResolvedValue({ uid: "user-1" });

    await completeMemberActivation("user-1", "Secret1a");

    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockUpdateUser).toHaveBeenCalledWith("user-1", {
      email: "IS13984@giswelfare.local",
      password: "Secret1a",
      displayName: "John Doe",
      disabled: false,
    });
    expect(mockActivateUserRecord).toHaveBeenCalled();
  });

  it("rejects already activated accounts", async () => {
    mockFindUserById.mockResolvedValue({
      ...baseUser,
      activationStatus: ActivationStatus.ACTIVATED,
    });

    await expect(
      completeMemberActivation("user-1", "Secret1a"),
    ).rejects.toThrow(/already been activated|not eligible/i);
  });
});
