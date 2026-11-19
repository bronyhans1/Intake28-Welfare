import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hashActivationOtp,
  getActivationOtpExpiry,
} from "@/lib/activation/otp";
import { ACTIVATION_OTP } from "@/lib/constants/activation-otp";

const mockFindUserById = vi.fn();
const mockUpdateUserOtpTracking = vi.fn();

vi.mock("@/lib/activation/repository", () => ({
  findUserById: (...args: unknown[]) => mockFindUserById(...args),
  updateUserOtpTracking: (...args: unknown[]) =>
    mockUpdateUserOtpTracking(...args),
}));

import {
  clearOtpCode,
  generateOtpCode,
  hasActiveOtpCode,
  storeOtpCode,
  verifyOtpCode,
} from "@/lib/activation/otp-store";

describe("activation otp-store (Firestore-backed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ACTIVATION_SESSION_SECRET =
      "test-secret-with-at-least-32-characters-long";
    mockUpdateUserOtpTracking.mockResolvedValue(undefined);
  });

  it("generates a 6-digit OTP", () => {
    const otp = generateOtpCode();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it("persists only the OTP hash", async () => {
    await storeOtpCode("user-1", "123456");

    expect(mockUpdateUserOtpTracking).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        activationOtp: hashActivationOtp("user-1", "123456"),
        activationOtpExpiresAt: expect.any(Date),
      }),
    );

    const storedHash = mockUpdateUserOtpTracking.mock.calls[0][1]
      .activationOtp as string;
    expect(storedHash).not.toBe("123456");
  });

  it("detects active OTP from persisted user record", async () => {
    const expiresAt = getActivationOtpExpiry();
    mockFindUserById.mockResolvedValue({
      id: "user-1",
      activationOtp: hashActivationOtp("user-1", "123456"),
      activationOtpExpiresAt: expiresAt,
    });

    expect(await hasActiveOtpCode("user-1")).toBe(true);
  });

  it("verifies correct OTP and clears persisted hash", async () => {
    const expiresAt = getActivationOtpExpiry();
    mockFindUserById.mockResolvedValue({
      id: "user-1",
      activationOtp: hashActivationOtp("user-1", "123456"),
      activationOtpExpiresAt: expiresAt,
    });

    expect(await verifyOtpCode("user-1", "123456")).toBe(true);
    expect(mockUpdateUserOtpTracking).toHaveBeenCalledWith("user-1", {
      activationOtp: null,
      activationOtpExpiresAt: null,
    });
  });

  it("rejects invalid OTP without clearing hash", async () => {
    const expiresAt = getActivationOtpExpiry();
    mockFindUserById.mockResolvedValue({
      id: "user-1",
      activationOtp: hashActivationOtp("user-1", "123456"),
      activationOtpExpiresAt: expiresAt,
    });

    expect(await verifyOtpCode("user-1", "000000")).toBe(false);
    expect(mockUpdateUserOtpTracking).not.toHaveBeenCalled();
  });

  it("rejects expired OTP and clears persisted hash", async () => {
    const expiredAt = new Date(Date.now() - 60_000);
    mockFindUserById.mockResolvedValue({
      id: "user-1",
      activationOtp: hashActivationOtp("user-1", "123456"),
      activationOtpExpiresAt: expiredAt,
    });

    expect(await verifyOtpCode("user-1", "123456")).toBe(false);
    expect(mockUpdateUserOtpTracking).toHaveBeenCalledWith("user-1", {
      activationOtp: null,
      activationOtpExpiresAt: null,
    });
  });

  it("clears OTP explicitly", async () => {
    await clearOtpCode("user-1");
    expect(mockUpdateUserOtpTracking).toHaveBeenCalledWith("user-1", {
      activationOtp: null,
      activationOtpExpiresAt: null,
    });
  });

  it("survives separate service invocations via Firestore reads", async () => {
    const expiresAt = getActivationOtpExpiry();
    await storeOtpCode("user-1", "654321");

    mockFindUserById.mockResolvedValue({
      id: "user-1",
      activationOtp: hashActivationOtp("user-1", "654321"),
      activationOtpExpiresAt: expiresAt,
    });

    expect(await verifyOtpCode("user-1", "654321")).toBe(true);
  });

  it("uses 10-minute expiry constant", async () => {
    const now = new Date("2026-06-14T12:00:00Z");
    await storeOtpCode("user-1", "123456", now);

    const expiresAt = mockUpdateUserOtpTracking.mock.calls[0][1]
      .activationOtpExpiresAt as Date;
    expect(expiresAt.getTime() - now.getTime()).toBe(
      ACTIVATION_OTP.CODE_EXPIRY_MINUTES * 60 * 1000,
    );
  });
});
