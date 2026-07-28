import { describe, expect, it } from "vitest";
import { UserRole } from "@/types/enums";
import { canAccessRoute, isMemberPortalRoute } from "@/lib/auth/routes";

describe("isMemberPortalRoute", () => {
  it("matches dashboard and portal profile routes", () => {
    expect(isMemberPortalRoute("/dashboard")).toBe(true);
    expect(isMemberPortalRoute("/portal/profile")).toBe(true);
    expect(isMemberPortalRoute("/portal/profile/edit")).toBe(true);
  });

  it("does not match admin routes", () => {
    expect(isMemberPortalRoute("/admin/dashboard")).toBe(false);
  });
});

describe("member route permissions", () => {
  it("allows members on member portal routes", () => {
    expect(canAccessRoute(UserRole.MEMBER, "/dashboard")).toBe(true);
    expect(canAccessRoute(UserRole.MEMBER, "/portal/profile")).toBe(true);
    expect(canAccessRoute(UserRole.MEMBER, "/portal/profile/edit")).toBe(true);
  });

  it("blocks members from admin routes", () => {
    expect(canAccessRoute(UserRole.MEMBER, "/admin/dashboard")).toBe(false);
    expect(canAccessRoute(UserRole.MEMBER, "/admin/members")).toBe(false);
  });

  it("allows admin access to admin routes", () => {
    expect(canAccessRoute(UserRole.ADMIN, "/admin/dashboard")).toBe(true);
    expect(canAccessRoute(UserRole.ADMIN, "/admin/members")).toBe(true);
  });

  it("allows treasurer access to membership requests", () => {
    expect(canAccessRoute(UserRole.TREASURER, "/admin/membership-requests")).toBe(
      true,
    );
    expect(canAccessRoute(UserRole.ADMIN, "/admin/membership-requests")).toBe(
      true,
    );
    expect(canAccessRoute(UserRole.MEMBER, "/admin/membership-requests")).toBe(
      false,
    );
  });

  it("allows treasurer access to treasurer admin routes", () => {
    expect(canAccessRoute(UserRole.TREASURER, "/admin/payments")).toBe(true);
    expect(canAccessRoute(UserRole.TREASURER, "/admin/members")).toBe(true);
    expect(canAccessRoute(UserRole.TREASURER, "/admin/members/pending")).toBe(true);
    expect(canAccessRoute(UserRole.TREASURER, "/admin/welfare-support")).toBe(true);
    expect(canAccessRoute(UserRole.TREASURER, "/admin/audit-logs")).toBe(true);
    expect(canAccessRoute(UserRole.TREASURER, "/admin/finance")).toBe(true);
    expect(canAccessRoute(UserRole.TREASURER, "/admin/contributions")).toBe(true);
    expect(canAccessRoute(UserRole.TREASURER, "/admin/settings")).toBe(false);
  });

  it("allows admin access to finance dashboard", () => {
    expect(canAccessRoute(UserRole.ADMIN, "/admin/finance")).toBe(true);
  });

  it("blocks members from finance dashboard", () => {
    expect(canAccessRoute(UserRole.MEMBER, "/admin/finance")).toBe(false);
  });

  it("allows admin and treasurer access to defaulters page", () => {
    expect(canAccessRoute(UserRole.ADMIN, "/admin/finance/defaulters")).toBe(true);
    expect(canAccessRoute(UserRole.TREASURER, "/admin/finance/defaulters")).toBe(true);
  });

  it("allows admin and treasurer access to reconciliation page", () => {
    expect(canAccessRoute(UserRole.ADMIN, "/admin/finance/reconciliation")).toBe(true);
    expect(canAccessRoute(UserRole.TREASURER, "/admin/finance/reconciliation")).toBe(true);
    expect(canAccessRoute(UserRole.MEMBER, "/admin/finance/reconciliation")).toBe(false);
  });

  it("blocks members from defaulters page", () => {
    expect(canAccessRoute(UserRole.MEMBER, "/admin/finance/defaulters")).toBe(false);
  });

  it("allows admin and treasurer access to reports", () => {
    expect(canAccessRoute(UserRole.ADMIN, "/admin/reports")).toBe(true);
    expect(canAccessRoute(UserRole.TREASURER, "/admin/reports")).toBe(true);
  });

  it("blocks members from reports", () => {
    expect(canAccessRoute(UserRole.MEMBER, "/admin/reports")).toBe(false);
  });

  it("allows members on welfare support portal route", () => {
    expect(canAccessRoute(UserRole.MEMBER, "/portal/welfare-support")).toBe(true);
  });

  it("allows members on contributions portal route", () => {
    expect(canAccessRoute(UserRole.MEMBER, "/portal/contributions")).toBe(true);
  });

  it("allows admin and treasurer access to announcements admin routes", () => {
    expect(canAccessRoute(UserRole.ADMIN, "/admin/announcements")).toBe(true);
    expect(canAccessRoute(UserRole.TREASURER, "/admin/announcements")).toBe(true);
    expect(canAccessRoute(UserRole.TREASURER, "/admin/announcements/new")).toBe(true);
  });

  it("allows admin and treasurer access to notifications", () => {
    expect(canAccessRoute(UserRole.ADMIN, "/admin/notifications")).toBe(true);
    expect(canAccessRoute(UserRole.TREASURER, "/admin/notifications")).toBe(true);
    expect(canAccessRoute(UserRole.MEMBER, "/admin/notifications")).toBe(false);
  });

  it("allows members on portal announcements route", () => {
    expect(canAccessRoute(UserRole.MEMBER, "/portal/announcements")).toBe(true);
  });

  it("allows admin and treasurer on executive member portal routes", () => {
    const routes = [
      "/dashboard",
      "/portal/profile",
      "/portal/contributions",
      "/portal/welfare-support",
      "/portal/announcements",
      "/payments",
      "/receipts",
    ] as const;

    for (const route of routes) {
      expect(canAccessRoute(UserRole.ADMIN, route)).toBe(true);
      expect(canAccessRoute(UserRole.TREASURER, route)).toBe(true);
    }
  });
});
