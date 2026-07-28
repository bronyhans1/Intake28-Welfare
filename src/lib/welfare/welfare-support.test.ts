import { describe, expect, it, vi, beforeEach } from "vitest";
import { WelfareSupportAuditAction } from "@/lib/welfare/audit";
import { WelfareSupportStatus, WelfareSupportType } from "@/types/enums";
import type { CreateWelfareSupportInput } from "@/lib/validators/welfare-support";
import type { CurrentUser } from "@/types/auth";
import { UserRole } from "@/types/enums";
import { hasPermission, Permission } from "@/lib/auth/permissions";

// ─── Audit action constants ──────────────────────────────────────────────────

describe("WelfareSupportAuditAction", () => {
  it("has welfare_support_created", () => {
    expect(WelfareSupportAuditAction.WELFARE_SUPPORT_CREATED).toBe("welfare_support_created");
  });

  it("has welfare_support_updated", () => {
    expect(WelfareSupportAuditAction.WELFARE_SUPPORT_UPDATED).toBe("welfare_support_updated");
  });
});

// ─── Permissions ─────────────────────────────────────────────────────────────

describe("welfare support permissions", () => {
  it("allows admin to view welfare support", () => {
    expect(hasPermission(UserRole.ADMIN, Permission.VIEW_WELFARE_SUPPORT)).toBe(true);
  });

  it("allows admin to create welfare support", () => {
    expect(hasPermission(UserRole.ADMIN, Permission.CREATE_WELFARE_SUPPORT)).toBe(true);
  });

  it("allows admin to edit welfare support", () => {
    expect(hasPermission(UserRole.ADMIN, Permission.EDIT_WELFARE_SUPPORT)).toBe(true);
  });

  it("allows treasurer to view welfare support", () => {
    expect(hasPermission(UserRole.TREASURER, Permission.VIEW_WELFARE_SUPPORT)).toBe(true);
  });

  it("allows treasurer to create welfare support", () => {
    expect(hasPermission(UserRole.TREASURER, Permission.CREATE_WELFARE_SUPPORT)).toBe(true);
  });

  it("allows treasurer to edit welfare support", () => {
    expect(hasPermission(UserRole.TREASURER, Permission.EDIT_WELFARE_SUPPORT)).toBe(true);
  });

  it("does NOT allow member to view welfare support via admin permission", () => {
    expect(hasPermission(UserRole.MEMBER, Permission.VIEW_WELFARE_SUPPORT)).toBe(false);
  });

  it("allows member to view own welfare support", () => {
    expect(hasPermission(UserRole.MEMBER, Permission.VIEW_OWN_WELFARE_SUPPORT)).toBe(true);
  });

  it("does NOT allow member to create welfare support", () => {
    expect(hasPermission(UserRole.MEMBER, Permission.CREATE_WELFARE_SUPPORT)).toBe(false);
  });

  it("does NOT allow member to edit welfare support", () => {
    expect(hasPermission(UserRole.MEMBER, Permission.EDIT_WELFARE_SUPPORT)).toBe(false);
  });
});

// ─── Reporting fields ────────────────────────────────────────────────────────

describe("welfare support reporting fields derivation", () => {
  function deriveReportingFields(now: Date): { supportYear: number; supportMonth: number } {
    return {
      supportYear: now.getFullYear(),
      supportMonth: now.getMonth() + 1,
    };
  }

  it("derives supportYear from createdAt date", () => {
    const date = new Date("2026-06-15T10:00:00Z");
    const { supportYear } = deriveReportingFields(date);
    expect(supportYear).toBe(2026);
  });

  it("derives supportMonth from createdAt date (1-based)", () => {
    const date = new Date("2026-06-15T10:00:00Z");
    const { supportMonth } = deriveReportingFields(date);
    expect(supportMonth).toBe(6);
  });

  it("uses 1 for January", () => {
    const date = new Date("2026-01-01T00:00:00Z");
    const { supportMonth } = deriveReportingFields(date);
    expect(supportMonth).toBe(1);
  });

  it("uses 12 for December", () => {
    const date = new Date("2026-12-31T23:59:59Z");
    const { supportMonth } = deriveReportingFields(date);
    expect(supportMonth).toBe(12);
  });

  it("is 1-based not 0-based", () => {
    const date = new Date("2026-03-10T00:00:00Z");
    const { supportMonth } = deriveReportingFields(date);
    expect(supportMonth).not.toBe(2); // not 0-based March
    expect(supportMonth).toBe(3);
  });
});

// ─── WelfareSupportStatus enum ───────────────────────────────────────────────

describe("WelfareSupportStatus", () => {
  it("has approved status for phase 5A", () => {
    expect(WelfareSupportStatus.APPROVED).toBe("approved");
  });

  it("has structure for future statuses: pending, paid, cancelled", () => {
    expect(WelfareSupportStatus.PENDING).toBe("pending");
    expect(WelfareSupportStatus.PAID).toBe("paid");
    expect(WelfareSupportStatus.CANCELLED).toBe("cancelled");
  });
});

// ─── WelfareSupportType enum ─────────────────────────────────────────────────

describe("WelfareSupportType", () => {
  const EXPECTED_TYPES = [
    "funeral",
    "wedding",
    "naming",
    "medical",
    "education",
    "emergency",
    "bereavement",
    "other",
  ];

  it("has all 8 support types", () => {
    expect(Object.values(WelfareSupportType)).toHaveLength(8);
  });

  it.each(EXPECTED_TYPES)("has %s type", (type) => {
    expect(Object.values(WelfareSupportType)).toContain(type);
  });
});
