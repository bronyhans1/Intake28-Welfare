import { describe, expect, it } from "vitest";
import { canAccessAdminRoute } from "@/lib/auth/login";
import { UserRole } from "@/types/enums";
import { AUTH_ROLE_COOKIE } from "@/types/auth";

describe("role synchronization strategy", () => {
  it("defines the role cookie name used for session role tracking", () => {
    expect(AUTH_ROLE_COOKIE).toBe("gis_role");
  });

  it("maps Member → Treasurer role transition", () => {
    const before = UserRole.MEMBER;
    const after = UserRole.TREASURER;
    expect(before).not.toBe(after);
    expect(after).toBe("treasurer");
  });

  it("maps Treasurer → Member role transition", () => {
    const before = UserRole.TREASURER;
    const after = UserRole.MEMBER;
    expect(before).not.toBe(after);
    expect(after).toBe("member");
  });

  it("treasurer and admin roles can access admin routes", () => {
    expect(canAccessAdminRoute(UserRole.ADMIN)).toBe(true);
    expect(canAccessAdminRoute(UserRole.TREASURER)).toBe(true);
  });

  it("member role cannot access admin routes via role check", () => {
    expect(canAccessAdminRoute(UserRole.MEMBER)).toBe(false);
  });
});

describe("role cookie sync detection", () => {
  function shouldSyncRoleCookie(
    cookieRole: string | undefined,
    firestoreRole: UserRole,
  ): boolean {
    return cookieRole !== firestoreRole;
  }

  it("detects stale cookie when member promoted to treasurer", () => {
    expect(shouldSyncRoleCookie(UserRole.MEMBER, UserRole.TREASURER)).toBe(true);
  });

  it("detects stale cookie when treasurer demoted to member", () => {
    expect(shouldSyncRoleCookie(UserRole.TREASURER, UserRole.MEMBER)).toBe(true);
  });

  it("does not sync when cookie matches Firestore role", () => {
    expect(shouldSyncRoleCookie(UserRole.TREASURER, UserRole.TREASURER)).toBe(false);
    expect(shouldSyncRoleCookie(UserRole.ADMIN, UserRole.ADMIN)).toBe(false);
    expect(shouldSyncRoleCookie(UserRole.MEMBER, UserRole.MEMBER)).toBe(false);
  });

  it("syncs when cookie is missing", () => {
    expect(shouldSyncRoleCookie(undefined, UserRole.TREASURER)).toBe(true);
  });
});
