import { describe, expect, it } from "vitest";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { canAccessRoute } from "@/lib/auth/routes";
import { UserRole } from "@/types/enums";

describe("claims phase 1 permissions", () => {
  it("allows members to create and view own claims", () => {
    expect(hasPermission(UserRole.MEMBER, Permission.CREATE_CLAIM)).toBe(true);
    expect(hasPermission(UserRole.MEMBER, Permission.VIEW_OWN_CLAIMS)).toBe(true);
    expect(hasPermission(UserRole.MEMBER, Permission.MANAGE_CLAIM_TYPES)).toBe(
      false,
    );
    expect(hasPermission(UserRole.MEMBER, Permission.MANAGE_CONSTITUTIONS)).toBe(
      false,
    );
  });

  it("allows admins to manage claim types and constitutions", () => {
    expect(hasPermission(UserRole.ADMIN, Permission.MANAGE_CLAIM_TYPES)).toBe(
      true,
    );
    expect(hasPermission(UserRole.ADMIN, Permission.MANAGE_CONSTITUTIONS)).toBe(
      true,
    );
    expect(hasPermission(UserRole.ADMIN, Permission.VIEW_ALL_CLAIMS)).toBe(true);
  });

  it("allows treasurers to view claims and constitutions but not manage configs", () => {
    expect(hasPermission(UserRole.TREASURER, Permission.VIEW_ALL_CLAIMS)).toBe(
      true,
    );
    expect(hasPermission(UserRole.TREASURER, Permission.VIEW_CONSTITUTIONS)).toBe(
      true,
    );
    expect(
      hasPermission(UserRole.TREASURER, Permission.MANAGE_CLAIM_TYPES),
    ).toBe(false);
    expect(
      hasPermission(UserRole.TREASURER, Permission.MANAGE_CONSTITUTIONS),
    ).toBe(false);
  });

  it("allows executives to review and assign claims; members cannot", () => {
    expect(hasPermission(UserRole.ADMIN, Permission.REVIEW_CLAIMS)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, Permission.ASSIGN_CLAIMS)).toBe(true);
    expect(hasPermission(UserRole.TREASURER, Permission.REVIEW_CLAIMS)).toBe(
      true,
    );
    expect(hasPermission(UserRole.TREASURER, Permission.ASSIGN_CLAIMS)).toBe(
      true,
    );
    expect(hasPermission(UserRole.MEMBER, Permission.REVIEW_CLAIMS)).toBe(false);
    expect(hasPermission(UserRole.MEMBER, Permission.ASSIGN_CLAIMS)).toBe(false);
  });
});

describe("claims phase 1 routes", () => {
  it("allows members on /portal/claims", () => {
    expect(canAccessRoute(UserRole.MEMBER, "/portal/claims")).toBe(true);
  });

  it("allows admins on claim type, eligibility, and submitted claims pages", () => {
    expect(canAccessRoute(UserRole.ADMIN, "/admin/claims/types")).toBe(true);
    expect(canAccessRoute(UserRole.ADMIN, "/admin/claims/eligibility")).toBe(
      true,
    );
    expect(canAccessRoute(UserRole.ADMIN, "/admin/claims/submitted")).toBe(
      true,
    );
    expect(canAccessRoute(UserRole.ADMIN, "/admin/constitutions")).toBe(true);
  });

  it("allows treasurers on submitted claims", () => {
    expect(canAccessRoute(UserRole.TREASURER, "/admin/claims/submitted")).toBe(
      true,
    );
    expect(
      canAccessRoute(UserRole.TREASURER, "/admin/claims/submitted/abc"),
    ).toBe(true);
    expect(canAccessRoute(UserRole.TREASURER, "/admin/claims/finance")).toBe(
      true,
    );
  });

  it("allows finance claim payment processing for admin and treasurer only", () => {
    expect(
      hasPermission(UserRole.ADMIN, Permission.PROCESS_CLAIM_PAYMENTS),
    ).toBe(true);
    expect(
      hasPermission(UserRole.TREASURER, Permission.PROCESS_CLAIM_PAYMENTS),
    ).toBe(true);
    expect(
      hasPermission(UserRole.MEMBER, Permission.PROCESS_CLAIM_PAYMENTS),
    ).toBe(false);
  });
});
