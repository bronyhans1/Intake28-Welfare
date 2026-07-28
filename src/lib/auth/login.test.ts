import { describe, expect, it } from "vitest";
import { ActivationStatus, UserRole, UserStatus } from "@/types/enums";
import type { User } from "@/types/user";
import {
  ACCOUNT_INELIGIBLE_ERROR,
  GENERIC_LOGIN_ERROR,
  canAccessAdminRoute,
  getLoginRedirectPath,
  resolveProtectedRouteAccess,
  validateUserForLogin,
} from "@/lib/auth/login";

const baseUser: User = {
  id: "user-1",
  serviceNumber: "IS/13984",
  serviceNumberSuffix: "13984",
  fullName: "John Doe",
  phoneNumber: "0241234567",
  rank: "Inspector",
  station: "HQ",
  profileCompleted: false,
  profileCompletionPercentage: 50,
  role: UserRole.MEMBER,
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

describe("validateUserForLogin", () => {
  it("rejects missing users with a generic error", () => {
    const result = validateUserForLogin(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe(GENERIC_LOGIN_ERROR);
    expect(result.code).toBe("NOT_FOUND");
  });

  it("rejects users who have not activated", () => {
    const result = validateUserForLogin({
      ...baseUser,
      activationStatus: ActivationStatus.PENDING,
    });

    expect(result.valid).toBe(false);
    expect(result.code).toBe("NOT_ACTIVATED");
    expect(result.error).toBe(ACCOUNT_INELIGIBLE_ERROR);
  });

  it("rejects inactive users", () => {
    const result = validateUserForLogin({
      ...baseUser,
      status: UserStatus.INACTIVE,
    });

    expect(result.valid).toBe(false);
    expect(result.code).toBe("INACTIVE");
    expect(result.error).toBe(ACCOUNT_INELIGIBLE_ERROR);
  });

  it("allows active activated users", () => {
    expect(validateUserForLogin(baseUser).valid).toBe(true);
  });
});

describe("role redirects", () => {
  it("redirects admin and treasurer to admin dashboard", () => {
    expect(getLoginRedirectPath(UserRole.ADMIN)).toBe("/admin/dashboard");
    expect(getLoginRedirectPath(UserRole.TREASURER)).toBe("/admin/dashboard");
  });

  it("redirects members to member dashboard", () => {
    expect(getLoginRedirectPath(UserRole.MEMBER)).toBe("/dashboard");
  });
});

describe("protected route access", () => {
  it("blocks unauthenticated access", () => {
    expect(resolveProtectedRouteAccess(null, "/dashboard")).toEqual({
      allowed: false,
      redirectTo: "/login",
    });
  });

  it("allows admin access to admin routes", () => {
    expect(resolveProtectedRouteAccess(UserRole.ADMIN, "/admin/dashboard")).toEqual({
      allowed: true,
    });
    expect(canAccessAdminRoute(UserRole.ADMIN)).toBe(true);
  });

  it("redirects members away from admin routes", () => {
    expect(resolveProtectedRouteAccess(UserRole.MEMBER, "/admin/dashboard")).toEqual({
      allowed: false,
      redirectTo: "/dashboard",
    });
    expect(canAccessAdminRoute(UserRole.MEMBER)).toBe(false);
  });

  it("allows members on member routes", () => {
    expect(resolveProtectedRouteAccess(UserRole.MEMBER, "/dashboard")).toEqual({
      allowed: true,
    });
  });
});
