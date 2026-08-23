import { describe, expect, it } from "vitest";
import { UserRole } from "@/types/enums";
import {
  canAccessMemberPortal,
  getExecutiveWithoutMemberRedirect,
  getMemberPortalAccessRedirect,
} from "@/lib/auth/member-portal-access";
import { canAccessRoute } from "@/lib/auth/routes";
import { resolveMiddlewareAuth } from "@/lib/auth/middleware-routing";
import { resolveProtectedRouteAccess } from "@/lib/auth/login";

const ORIGIN = "http://localhost:3000";

describe("canAccessMemberPortal", () => {
  it("allows members and linked-portal executive roles", () => {
    expect(canAccessMemberPortal(UserRole.MEMBER)).toBe(true);
    expect(canAccessMemberPortal(UserRole.ADMIN)).toBe(true);
    expect(canAccessMemberPortal(UserRole.TREASURER)).toBe(true);
  });
});

describe("getMemberPortalAccessRedirect", () => {
  it("keeps eligible roles on the requested route", () => {
    expect(
      getMemberPortalAccessRedirect(UserRole.MEMBER, "/portal/welfare-support"),
    ).toBe("/portal/welfare-support");
    expect(
      getMemberPortalAccessRedirect(UserRole.TREASURER, "/portal/welfare-support"),
    ).toBe("/portal/welfare-support");
  });

  it("sends unknown roles to login", () => {
    expect(getExecutiveWithoutMemberRedirect(UserRole.ADMIN)).toBe(
      "/admin/dashboard",
    );
  });
});

describe("member portal route access regression", () => {
  it("A: MEMBER can access /portal/welfare-support", () => {
    expect(canAccessRoute(UserRole.MEMBER, "/portal/welfare-support")).toBe(true);
    expect(
      resolveProtectedRouteAccess(UserRole.MEMBER, "/portal/welfare-support"),
    ).toEqual({ allowed: true });
  });

  it("C/D: linked executives can access their own member portal routes", () => {
    expect(canAccessRoute(UserRole.TREASURER, "/portal/welfare-support")).toBe(
      true,
    );
    expect(canAccessRoute(UserRole.ADMIN, "/portal/welfare-support")).toBe(true);
    expect(
      resolveProtectedRouteAccess(UserRole.TREASURER, "/portal/welfare-support"),
    ).toEqual({ allowed: true });
  });

  it("E/F: treasurer and admin can access admin welfare records", () => {
    expect(canAccessRoute(UserRole.TREASURER, "/admin/welfare-support")).toBe(true);
    expect(canAccessRoute(UserRole.ADMIN, "/admin/welfare-support")).toBe(true);
  });

  it("G: middleware allows treasurer portal welfare visits (server verifies member link)", () => {
    const decision = resolveMiddlewareAuth(
      "/portal/welfare-support",
      true,
      ORIGIN,
    );

    expect(decision).toEqual({ action: "allow" });
  });

  it("H: member portal routes remain available to members and executives", () => {
    const memberRoutes = [
      "/dashboard",
      "/portal/profile",
      "/portal/claims",
      "/portal/contributions",
      "/portal/announcements",
      "/portal/notifications",
      "/payments",
      "/receipts",
    ] as const;

    for (const route of memberRoutes) {
      expect(canAccessRoute(UserRole.MEMBER, route)).toBe(true);
      expect(canAccessRoute(UserRole.TREASURER, route)).toBe(true);
      expect(canAccessRoute(UserRole.ADMIN, route)).toBe(true);
    }
  });
});
