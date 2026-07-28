import { ActivationStatus, UserRole, UserStatus } from "@/types/enums";
import type { User } from "@/types/user";

export type LoginValidationCode =
  | "NOT_FOUND"
  | "NOT_ACTIVATED"
  | "INACTIVE"
  | "DISABLED";

export interface LoginValidationResult {
  valid: boolean;
  error?: string;
  code?: LoginValidationCode;
}

export const GENERIC_LOGIN_ERROR =
  "Invalid service number or password." as const;

export const ACCOUNT_INELIGIBLE_ERROR =
  "Your account is not eligible to sign in. Please contact your administrator." as const;

export function validateUserForLogin(user: User | null): LoginValidationResult {
  if (!user) {
    return {
      valid: false,
      error: GENERIC_LOGIN_ERROR,
      code: "NOT_FOUND",
    };
  }

  if (user.activationStatus !== ActivationStatus.ACTIVATED) {
    return {
      valid: false,
      error: ACCOUNT_INELIGIBLE_ERROR,
      code: "NOT_ACTIVATED",
    };
  }

  if (user.status !== UserStatus.ACTIVE) {
    return {
      valid: false,
      error: ACCOUNT_INELIGIBLE_ERROR,
      code: "INACTIVE",
    };
  }

  return { valid: true };
}

export function getLoginRedirectPath(role: UserRole): string {
  if (role === UserRole.ADMIN || role === UserRole.TREASURER) {
    return "/admin/dashboard";
  }

  return "/dashboard";
}

export function isAdminRoute(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function canAccessAdminRoute(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.TREASURER;
}

export function resolveProtectedRouteAccess(
  role: UserRole | null | undefined,
  pathname: string,
): { allowed: boolean; redirectTo?: string } {
  if (!role) {
    return { allowed: false, redirectTo: "/login" };
  }

  if (isAdminRoute(pathname)) {
    if (!canAccessAdminRoute(role)) {
      return { allowed: false, redirectTo: "/dashboard" };
    }
    return { allowed: true };
  }

  if (role === UserRole.ADMIN || role === UserRole.TREASURER) {
    return { allowed: true };
  }

  if (role === UserRole.MEMBER) {
    return { allowed: true };
  }

  return { allowed: false, redirectTo: "/login" };
}
