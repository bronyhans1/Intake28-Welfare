import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTION_LABELS,
  formatAuditActionLabel,
  formatAuditDescription,
  formatAuditEntityLabel,
} from "@/lib/audit/labels";
import { MemberAuditAction } from "@/lib/members/audit";
import { ContributionAuditAction } from "@/lib/contributions/audit";
import { PasswordResetAuditAction } from "@/lib/password-reset/audit";
import { ReportAuditAction } from "@/lib/reports/audit";
import { AnnouncementAuditAction } from "@/lib/announcements/audit";
import { WelfareSupportAuditAction } from "@/lib/welfare/audit";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { UserRole } from "@/types/enums";

describe("audit action labels", () => {
  it("includes all required audit events", () => {
    expect(AUDIT_ACTION_LABELS[MemberAuditAction.MEMBER_CREATED]).toBe("Member created");
    expect(AUDIT_ACTION_LABELS[MemberAuditAction.MEMBER_UPDATED]).toBe("Member updated");
    expect(AUDIT_ACTION_LABELS[MemberAuditAction.ACTIVATION_RESET]).toBe("Activation reset");
    expect(AUDIT_ACTION_LABELS[MemberAuditAction.STATUS_CHANGED]).toBe("Status changed");
    expect(AUDIT_ACTION_LABELS[MemberAuditAction.ROLE_CHANGED]).toBe("Role changed");
    expect(AUDIT_ACTION_LABELS[ContributionAuditAction.CONTRIBUTION_CREATED]).toBe(
      "Contribution recorded",
    );
    expect(AUDIT_ACTION_LABELS[ContributionAuditAction.CONTRIBUTION_UPDATED]).toBe(
      "Contribution updated",
    );
    expect(AUDIT_ACTION_LABELS[WelfareSupportAuditAction.WELFARE_SUPPORT_CREATED]).toBe(
      "Welfare support created",
    );
    expect(AUDIT_ACTION_LABELS[WelfareSupportAuditAction.WELFARE_SUPPORT_UPDATED]).toBe(
      "Welfare support updated",
    );
    expect(AUDIT_ACTION_LABELS[PasswordResetAuditAction.PASSWORD_RESET_REQUESTED]).toBe(
      "Password reset requested",
    );
    expect(AUDIT_ACTION_LABELS[PasswordResetAuditAction.PASSWORD_RESET_COMPLETED]).toBe(
      "Password reset completed",
    );
    expect(AUDIT_ACTION_LABELS[ReportAuditAction.REPORT_EXPORTED]).toBe("Report exported");
    expect(AUDIT_ACTION_LABELS[AnnouncementAuditAction.ANNOUNCEMENT_CREATED]).toBe(
      "Announcement created",
    );
    expect(AUDIT_ACTION_LABELS[AnnouncementAuditAction.ANNOUNCEMENT_UPDATED]).toBe(
      "Announcement updated",
    );
    expect(AUDIT_ACTION_LABELS[AnnouncementAuditAction.ANNOUNCEMENT_PUBLISHED]).toBe(
      "Announcement published",
    );
    expect(AUDIT_ACTION_LABELS[AnnouncementAuditAction.ANNOUNCEMENT_ARCHIVED]).toBe(
      "Announcement archived",
    );
  });

  it("formats role change descriptions", () => {
    const description = formatAuditDescription(
      MemberAuditAction.ROLE_CHANGED,
      undefined,
      { role: { before: "member", after: "treasurer" } },
    );
    expect(description).toBe("Role changed from member to treasurer");
  });

  it("formats welfare support entity labels", () => {
    const label = formatAuditEntityLabel("welfare_support", "rec-1", {
      memberName: "John Doe",
      serviceNumber: "IS/13984",
    });
    expect(label).toBe("John Doe (IS/13984)");
  });

  it("formats contribution entity labels without Firestore IDs", () => {
    const label = formatAuditEntityLabel("contribution", "eyxVNpXCabc123", {
      memberName: "Mary Baah",
      serviceNumber: "IS/13989",
    });
    expect(label).toBe("Mary Baah (IS/13989)");
  });

  it("formats claim type entity labels without database terminology", () => {
    expect(
      formatAuditEntityLabel("claim_type_config", "funeral", {
        displayName: "Funeral",
        code: "funeral",
      }),
    ).toBe("Claim Type — Funeral");

    expect(
      formatAuditEntityLabel("claim_type_config", "abc123XYZ78901234", {
        code: "parent_benefit",
      }),
    ).toBe("Claim Type — Parent Benefit");
  });

  it("formats constitution and membership request entity labels", () => {
    expect(
      formatAuditEntityLabel("constitution", "constitution_v1", {
        displayName: "GIS Intake 28 Welfare Constitution",
      }),
    ).toBe("Constitution — GIS Intake 28 Welfare Constitution");

    expect(
      formatAuditEntityLabel("membership_request", "req-1", {
        fullName: "Ama Mensah",
        serviceNumber: "IS/14001",
      }),
    ).toBe("Membership Request — Ama Mensah (IS/14001)");
  });

  it("formats claim entity labels with claim number", () => {
    expect(
      formatAuditEntityLabel("claim", "opaqueClaimId123456", {
        claimNumber: "GIS-2026-00001",
      }),
    ).toBe("Claim — GIS-2026-00001");
  });

  it("never falls back to raw entityType entityId wording", () => {
    const label = formatAuditEntityLabel(
      "claim_type_config",
      "opaqueFirestoreId123456",
    );
    expect(label).toBe("Claim Type");
    expect(label).not.toMatch(/claim_type_config/);
    expect(label).not.toMatch(/opaqueFirestoreId/);
  });

  it("formats contribution created descriptions", () => {
    const description = formatAuditDescription(
      ContributionAuditAction.CONTRIBUTION_CREATED,
      {
        memberName: "Mary Baah",
        serviceNumber: "IS/13989",
        contributionType: "monthly_dues",
        amount: 50,
      },
    );
    expect(description).toBe("Monthly Dues recorded for Mary Baah (IS/13989) — GHS 50.00");
  });

  it("formats contribution updated descriptions", () => {
    const description = formatAuditDescription(
      ContributionAuditAction.CONTRIBUTION_UPDATED,
      {
        memberName: "Eva Danso",
        serviceNumber: "IS/13987",
        contributionType: "special_contribution",
        amount: 200,
      },
    );
    expect(description).toBe(
      "Special Contribution updated for Eva Danso (IS/13987) — GHS 200.00",
    );
  });

  it("falls back to formatted action for unknown actions", () => {
    expect(formatAuditActionLabel("custom_action")).toBe("custom action");
  });
});

describe("audit log permissions", () => {
  it("allows admin to view audit logs", () => {
    expect(hasPermission(UserRole.ADMIN, Permission.VIEW_AUDIT_LOGS)).toBe(true);
  });

  it("allows treasurer to view audit logs", () => {
    expect(hasPermission(UserRole.TREASURER, Permission.VIEW_AUDIT_LOGS)).toBe(true);
  });

  it("does not allow member to view audit logs", () => {
    expect(hasPermission(UserRole.MEMBER, Permission.VIEW_AUDIT_LOGS)).toBe(false);
  });
});
