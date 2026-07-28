import { describe, expect, it } from "vitest";
import { canAccessRoute } from "@/lib/auth/routes";
import {
  hasPermission,
  MEMBER_PERMISSIONS,
  Permission,
} from "@/lib/auth/permissions";
import { UserRole } from "@/types/enums";

const EXECUTIVE_MEMBER_ROUTES = [
  "/dashboard",
  "/portal/profile",
  "/portal/contributions",
  "/portal/welfare-support",
  "/portal/claims",
  "/portal/announcements",
  "/portal/notifications",
  "/payments",
  "/receipts",
] as const;

describe("executive member permissions", () => {
  it("grants every member permission to admin and treasurer", () => {
    for (const permission of MEMBER_PERMISSIONS) {
      expect(hasPermission(UserRole.ADMIN, permission)).toBe(true);
      expect(hasPermission(UserRole.TREASURER, permission)).toBe(true);
    }
  });

  it("retains elevated admin permissions", () => {
    expect(hasPermission(UserRole.ADMIN, Permission.MANAGE_SETTINGS)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, Permission.VIEW_PAYMENTS)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, Permission.VIEW_WELFARE_SUPPORT)).toBe(true);
  });

  it("retains elevated treasurer permissions without admin-only settings", () => {
    expect(hasPermission(UserRole.TREASURER, Permission.VIEW_PAYMENTS)).toBe(true);
    expect(hasPermission(UserRole.TREASURER, Permission.MANAGE_SETTINGS)).toBe(false);
    expect(hasPermission(UserRole.TREASURER, Permission.VIEW_WELFARE_SUPPORT)).toBe(true);
  });

  it("allows admin and treasurer to pay contributions", () => {
    expect(hasPermission(UserRole.ADMIN, Permission.MAKE_PAYMENTS)).toBe(true);
    expect(hasPermission(UserRole.TREASURER, Permission.MAKE_PAYMENTS)).toBe(true);
  });

  it("allows admin and treasurer to access member receipts", () => {
    expect(hasPermission(UserRole.ADMIN, Permission.VIEW_RECEIPTS)).toBe(true);
    expect(hasPermission(UserRole.TREASURER, Permission.VIEW_RECEIPTS)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, Permission.DOWNLOAD_RECEIPTS)).toBe(true);
    expect(hasPermission(UserRole.TREASURER, Permission.DOWNLOAD_RECEIPTS)).toBe(true);
    expect(hasPermission(UserRole.MEMBER, Permission.DOWNLOAD_RECEIPTS)).toBe(true);
    expect(hasPermission(UserRole.MEMBER, Permission.VIEW_RECONCILIATION)).toBe(false);
  });

  it("allows admin and treasurer to view reconciliation", () => {
    expect(hasPermission(UserRole.ADMIN, Permission.VIEW_RECONCILIATION)).toBe(true);
    expect(hasPermission(UserRole.TREASURER, Permission.VIEW_RECONCILIATION)).toBe(true);
  });

  it("grants notification permissions to admin and treasurer only", () => {
    expect(hasPermission(UserRole.ADMIN, Permission.VIEW_NOTIFICATIONS)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, Permission.MANAGE_NOTIFICATIONS)).toBe(true);
    expect(hasPermission(UserRole.TREASURER, Permission.VIEW_NOTIFICATIONS)).toBe(true);
    expect(hasPermission(UserRole.TREASURER, Permission.MANAGE_NOTIFICATIONS)).toBe(true);
    expect(hasPermission(UserRole.MEMBER, Permission.VIEW_NOTIFICATIONS)).toBe(false);
    expect(hasPermission(UserRole.MEMBER, Permission.MANAGE_NOTIFICATIONS)).toBe(false);
  });
});

describe("executive member route access", () => {
  it("allows admin and treasurer on member portal routes", () => {
    for (const route of EXECUTIVE_MEMBER_ROUTES) {
      expect(canAccessRoute(UserRole.ADMIN, route)).toBe(true);
      expect(canAccessRoute(UserRole.TREASURER, route)).toBe(true);
    }
  });
});
