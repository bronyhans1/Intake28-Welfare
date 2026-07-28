import { MembershipRequestAuditAction } from "@/lib/membership-requests/audit";
import { MemberAuditAction } from "@/lib/members/audit";
import { PhoneVerificationAuditAction } from "@/lib/phone-verification/audit";
import { ContributionAuditAction } from "@/lib/contributions/audit";
import { formatContributionTypeLabel } from "@/lib/contributions/labels";
import { PaymentAuditAction } from "@/lib/payments/audit";
import { ReceiptAuditAction } from "@/lib/receipts/audit";
import { PasswordResetAuditAction } from "@/lib/password-reset/audit";
import { ReportAuditAction } from "@/lib/reports/audit";
import { AnnouncementAuditAction } from "@/lib/announcements/audit";
import { SettingsAuditAction } from "@/lib/system-settings/audit";
import { WelfareSupportAuditAction } from "@/lib/welfare/audit";
import { ProgressionAuditAction } from "@/lib/progression/audit";
import { formatCurrency } from "@/lib/utils/currency";
import {
  MEMBERSHIP_PROGRESSION_STATUS_LABELS,
  MembershipProgressionStatus,
} from "@/types/enums";

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  [MemberAuditAction.MEMBER_CREATED]: "Member created",
  [MemberAuditAction.MEMBER_UPDATED]: "Member updated",
  [MemberAuditAction.ACTIVATION_RESET]: "Activation reset",
  [MemberAuditAction.STATUS_CHANGED]: "Status changed",
  [MemberAuditAction.ROLE_CHANGED]: "Role changed",
  [MemberAuditAction.EMAIL_ADDED]: "Email added",
  [MemberAuditAction.EMAIL_UPDATED]: "Email updated",
  [MemberAuditAction.EMAIL_REMOVED]: "Email removed",
  [MemberAuditAction.PROFILE_PHOTO_UPLOADED]: "Profile photo uploaded",
  [MemberAuditAction.PROFILE_PHOTO_UPDATED]: "Profile photo updated",
  [MemberAuditAction.PROFILE_PHOTO_REMOVED]: "Profile photo removed",
  [MemberAuditAction.PARENT_INFORMATION_SAVED]: "Parent information saved",
  [MemberAuditAction.PARENT_INFORMATION_OVERRIDE]: "Parent information override",
  [MembershipRequestAuditAction.MEMBERSHIP_REQUEST_SUBMITTED]:
    "Membership request submitted",
  [MembershipRequestAuditAction.MEMBERSHIP_REQUEST_APPROVED]:
    "Membership request approved",
  [MembershipRequestAuditAction.MEMBERSHIP_REQUEST_DECLINED]:
    "Membership request declined",
  [MembershipRequestAuditAction.MEMBER_CREATED_FROM_REQUEST]:
    "Member created from request",
  claim_draft_created: "Claim draft created",
  claim_draft_updated: "Claim draft updated",
  claim_draft_deleted: "Claim draft deleted",
  claim_type_created: "Claim type created",
  claim_type_updated: "Claim type updated",
  claim_type_deleted: "Claim type deleted",
  constitution_created: "Constitution draft created",
  constitution_updated: "Constitution draft updated",
  constitution_deleted: "Constitution draft deleted",
  [PhoneVerificationAuditAction.PHONE_VERIFICATION_REQUESTED]: "Phone verification requested",
  [PhoneVerificationAuditAction.PHONE_VERIFICATION_COMPLETED]: "Phone verification completed",
  [PhoneVerificationAuditAction.PHONE_VERIFICATION_EXPIRED]: "Phone verification expired",
  [PhoneVerificationAuditAction.PHONE_VERIFICATION_FAILED]: "Phone verification failed",
  [ContributionAuditAction.CONTRIBUTION_CREATED]: "Contribution recorded",
  [ContributionAuditAction.CONTRIBUTION_UPDATED]: "Contribution updated",
  [PasswordResetAuditAction.PASSWORD_RESET_REQUESTED]: "Password reset requested",
  [PasswordResetAuditAction.PASSWORD_RESET_COMPLETED]: "Password reset completed",
  [WelfareSupportAuditAction.WELFARE_SUPPORT_CREATED]: "Welfare support created",
  [WelfareSupportAuditAction.WELFARE_SUPPORT_UPDATED]: "Welfare support updated",
  [ReportAuditAction.REPORT_EXPORTED]: "Report exported",
  [AnnouncementAuditAction.ANNOUNCEMENT_CREATED]: "Announcement created",
  [AnnouncementAuditAction.ANNOUNCEMENT_UPDATED]: "Announcement updated",
  [AnnouncementAuditAction.ANNOUNCEMENT_PUBLISHED]: "Announcement published",
  [AnnouncementAuditAction.ANNOUNCEMENT_ARCHIVED]: "Announcement archived",
  [SettingsAuditAction.SETTINGS_UPDATED]: "Settings updated",
  [PaymentAuditAction.PAYMENT_INITIALIZED]: "Payment initialized",
  [PaymentAuditAction.PAYMENT_VERIFIED]: "Payment verified",
  [PaymentAuditAction.PAYMENT_CONTRIBUTION_CREATED]: "Payment contribution created",
  [ReceiptAuditAction.RECEIPT_GENERATED]: "Receipt generated",
  [ReceiptAuditAction.RECEIPT_DOWNLOADED]: "Receipt downloaded",
  [ReceiptAuditAction.RECEIPT_CANCELLED]: "Receipt cancelled",
  [ProgressionAuditAction.PROGRESSION_RECALCULATED]: "Progression recalculated",
  [ProgressionAuditAction.BENEFIT_PERCENTAGE_CHANGED]:
    "Benefit Percentage changed",
  [ProgressionAuditAction.MEMBERSHIP_STATUS_CHANGED]:
    "Membership Status changed",
  [ProgressionAuditAction.MATURITY_REACHED]: "Member reached Maturity",
  [ProgressionAuditAction.CLAIM_ELIGIBILITY_GAINED]:
    "Member became Claim Eligible",
};

export const AUDIT_ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export function formatAuditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

const AUDIT_ENTITY_TYPE_LABELS: Record<string, string> = {
  claim_type_config: "Claim Type",
  constitution: "Constitution",
  membership_progression: "Membership Progression",
  constitution_config: "Constitution",
  membership_request: "Membership Request",
  claim: "Claim",
  claim_submission: "Claim",
  claim_payment: "Claim Payment",
  user: "Member",
  member_profile: "Member",
  notification: "Notification",
  notification_record: "Notification",
  announcement: "Announcement",
  announcement_post: "Announcement",
  welfare_support: "Welfare Support",
  welfare_support_record: "Welfare Support",
  payment: "Payment",
  payment_record: "Payment",
  contribution: "Contribution",
  contribution_record: "Contribution",
  settings: "System Settings",
  report: "Report",
  receipt: "Receipt",
};

function humanizeIdentifier(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function looksLikeInternalId(value: string): boolean {
  if (!value) return true;
  if (value.includes("/")) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return true;
  }
  // Firestore-style auto IDs and other opaque tokens
  if (/^[A-Za-z0-9]{16,}$/.test(value)) return true;
  return false;
}

function formatEntityTypeLabel(entityType: string): string {
  if (!entityType) return "Record";
  return AUDIT_ENTITY_TYPE_LABELS[entityType] ?? humanizeIdentifier(entityType);
}

function formatNamedEntity(typeLabel: string, name: string | null): string {
  if (name) return `${typeLabel} — ${name}`;
  return typeLabel;
}

function firstString(
  metadata: Record<string, unknown> | undefined,
  keys: string[],
): string | null {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export function formatAuditEntityLabel(
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
): string {
  const typeLabel = formatEntityTypeLabel(entityType);
  const memberName =
    firstString(metadata, ["memberName", "fullName"]);
  const serviceNumber = firstString(metadata, ["serviceNumber"]);
  const displayName = firstString(metadata, ["displayName", "title", "name"]);
  const claimNumber = firstString(metadata, ["claimNumber", "reference"]);
  const code = firstString(metadata, ["code"]);
  const paymentReference = firstString(metadata, ["reference"]);

  if (entityType === "user" || entityType === "member_profile") {
    if (memberName && serviceNumber) return `${memberName} (${serviceNumber})`;
    if (memberName) return memberName;
    if (serviceNumber) return serviceNumber;
    return "Member";
  }

  if (entityType === "welfare_support" || entityType === "welfare_support_record") {
    if (memberName && serviceNumber) return `${memberName} (${serviceNumber})`;
    if (memberName) return memberName;
    return typeLabel;
  }

  if (entityType === "contribution" || entityType === "contribution_record") {
    if (memberName && serviceNumber) return `${memberName} (${serviceNumber})`;
    if (memberName) return memberName;
    if (serviceNumber) return serviceNumber;
    return typeLabel;
  }

  if (entityType === "report") {
    return formatReportTypeLabel(entityId);
  }

  if (entityType === "announcement" || entityType === "announcement_post") {
    return displayName ?? typeLabel;
  }

  if (entityType === "settings") {
    return "System Settings";
  }

  if (entityType === "payment" || entityType === "payment_record") {
    if (paymentReference && !looksLikeInternalId(paymentReference)) {
      return paymentReference;
    }
    return typeLabel;
  }

  if (entityType === "claim" || entityType === "claim_submission" || entityType === "claim_payment") {
    return formatNamedEntity(typeLabel, claimNumber);
  }

  if (entityType === "claim_type_config") {
    const claimTypeName =
      displayName ?? (code ? humanizeIdentifier(code) : null);
    return formatNamedEntity(typeLabel, claimTypeName);
  }

  if (entityType === "constitution" || entityType === "constitution_config") {
    return formatNamedEntity(typeLabel, displayName);
  }

  if (entityType === "membership_request") {
    if (memberName && serviceNumber) {
      return formatNamedEntity(typeLabel, `${memberName} (${serviceNumber})`);
    }
    return formatNamedEntity(typeLabel, memberName);
  }

  if (entityType === "receipt") {
    const receiptNumber = firstString(metadata, ["receiptNumber", "reference"]);
    return formatNamedEntity(typeLabel, receiptNumber);
  }

  if (entityType === "notification" || entityType === "notification_record") {
    return formatNamedEntity(typeLabel, displayName);
  }

  const fallbackName =
    displayName ??
    claimNumber ??
    (code ? humanizeIdentifier(code) : null) ??
    (entityId && !looksLikeInternalId(entityId)
      ? humanizeIdentifier(entityId)
      : null);

  return formatNamedEntity(typeLabel, fallbackName);
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  contributions: "Contributions",
  welfare_support: "Welfare Support",
  defaulters: "Defaulters",
  receipts: "Receipts",
  membership_progression: "Membership Progression",
  outstanding_contributions: "Outstanding Contributions",
};

function formatReportTypeLabel(reportType: string): string {
  return REPORT_TYPE_LABELS[reportType] ?? "Report";
}

function formatReportExportDescription(metadata?: Record<string, unknown>): string | null {
  const reportType =
    typeof metadata?.reportType === "string" ? metadata.reportType : null;
  const format = typeof metadata?.format === "string" ? metadata.format : null;

  if (!reportType || !format) {
    return null;
  }

  const formatLabel = format === "xlsx" ? "Excel" : "CSV";
  return `${formatReportTypeLabel(reportType)} Report exported (${formatLabel})`;
}

function formatContributionAuditDescription(
  verb: "recorded" | "updated",
  metadata?: Record<string, unknown>,
): string | null {
  const memberName =
    typeof metadata?.memberName === "string" ? metadata.memberName : null;
  const serviceNumber =
    typeof metadata?.serviceNumber === "string" ? metadata.serviceNumber : null;
  const contributionType =
    typeof metadata?.contributionType === "string" ? metadata.contributionType : null;
  const amount = typeof metadata?.amount === "number" ? metadata.amount : null;

  if (!contributionType || amount == null) {
    return null;
  }

  const typeLabel = formatContributionTypeLabel(contributionType);
  const amountLabel = formatCurrency(amount);
  const member =
    memberName && serviceNumber
      ? `${memberName} (${serviceNumber})`
      : memberName ?? serviceNumber ?? "member";

  return `${typeLabel} ${verb} for ${member} — ${amountLabel}`;
}

export function formatAuditDescription(
  action: string,
  metadata?: Record<string, unknown>,
  changes?: Record<string, { before: unknown; after: unknown }>,
): string {
  if (action === MemberAuditAction.ROLE_CHANGED && changes?.role) {
    return `Role changed from ${String(changes.role.before)} to ${String(changes.role.after)}`;
  }

  if (action === MemberAuditAction.STATUS_CHANGED && changes?.status) {
    return `Status changed from ${String(changes.status.before)} to ${String(changes.status.after)}`;
  }

  if (action === ProgressionAuditAction.PROGRESSION_RECALCULATED) {
    return "Progression recalculated.";
  }

  if (
    action === ProgressionAuditAction.BENEFIT_PERCENTAGE_CHANGED &&
    changes?.benefitPercentage
  ) {
    return `Benefit Percentage changed from ${String(changes.benefitPercentage.before)}% to ${String(changes.benefitPercentage.after)}%.`;
  }

  if (
    action === ProgressionAuditAction.MEMBERSHIP_STATUS_CHANGED &&
    changes?.membershipStatus
  ) {
    const before =
      MEMBERSHIP_PROGRESSION_STATUS_LABELS[
        changes.membershipStatus.before as MembershipProgressionStatus
      ] ?? String(changes.membershipStatus.before);
    const after =
      MEMBERSHIP_PROGRESSION_STATUS_LABELS[
        changes.membershipStatus.after as MembershipProgressionStatus
      ] ?? String(changes.membershipStatus.after);
    return `Membership Status changed from ${before} to ${after}.`;
  }

  if (action === ProgressionAuditAction.MATURITY_REACHED) {
    return "Member reached Maturity.";
  }

  if (action === ProgressionAuditAction.CLAIM_ELIGIBILITY_GAINED) {
    return "Member became Claim Eligible.";
  }

  const actorName =
    typeof metadata?.actorName === "string"
      ? metadata.actorName
      : typeof metadata?.fullName === "string"
        ? metadata.fullName
        : null;

  if (action === MemberAuditAction.EMAIL_ADDED) {
    return actorName
      ? `${actorName} added an email address`
      : "Email address added";
  }

  if (action === MemberAuditAction.EMAIL_UPDATED) {
    return actorName
      ? `${actorName} updated email address`
      : "Email address updated";
  }

  if (action === MemberAuditAction.EMAIL_REMOVED) {
    return actorName
      ? `${actorName} removed email address`
      : "Email address removed";
  }

  if (action === MemberAuditAction.PROFILE_PHOTO_UPLOADED) {
    return actorName
      ? `${actorName} uploaded a profile photo`
      : "Profile photo uploaded";
  }

  if (action === MemberAuditAction.PROFILE_PHOTO_UPDATED) {
    return actorName
      ? `${actorName} updated profile photo`
      : "Profile photo updated";
  }

  if (action === MemberAuditAction.PROFILE_PHOTO_REMOVED) {
    return actorName
      ? `${actorName} removed profile photo`
      : "Profile photo removed";
  }

  if (action === WelfareSupportAuditAction.WELFARE_SUPPORT_CREATED) {
    const amount = metadata?.amount;
    const supportType = metadata?.supportType;
    if (amount != null && supportType) {
      return `Recorded ${String(supportType)} support (${String(amount)})`;
    }
  }

  if (action === ContributionAuditAction.CONTRIBUTION_CREATED) {
    const description = formatContributionAuditDescription("recorded", metadata);
    if (description) {
      return description;
    }
  }

  if (action === ContributionAuditAction.CONTRIBUTION_UPDATED) {
    const description = formatContributionAuditDescription("updated", metadata);
    if (description) {
      return description;
    }
  }

  if (action === ReportAuditAction.REPORT_EXPORTED) {
    const description = formatReportExportDescription(metadata);
    if (description) {
      return description;
    }
  }

  if (action === AnnouncementAuditAction.ANNOUNCEMENT_PUBLISHED) {
    const title = typeof metadata?.title === "string" ? metadata.title : null;
    if (title) return `Published announcement "${title}"`;
  }

  if (action === AnnouncementAuditAction.ANNOUNCEMENT_ARCHIVED) {
    const title = typeof metadata?.title === "string" ? metadata.title : null;
    if (title) return `Archived announcement "${title}"`;
  }

  if (action === SettingsAuditAction.SETTINGS_UPDATED) {
    const updatedByName =
      typeof metadata?.updatedByName === "string" ? metadata.updatedByName : null;
    if (updatedByName) {
      return `Settings updated by ${updatedByName}`;
    }
    return "Settings updated";
  }

  if (action === PaymentAuditAction.PAYMENT_INITIALIZED) {
    const amount = typeof metadata?.amount === "number" ? metadata.amount : null;
    if (amount != null) {
      return `Payment initialized for ${formatCurrency(amount)}`;
    }
    return "Payment initialized";
  }

  if (action === PaymentAuditAction.PAYMENT_VERIFIED) {
    const status = typeof metadata?.status === "string" ? metadata.status : null;
    if (status === "success") {
      return "Payment verified successfully";
    }
    if (status) {
      return `Payment verification completed (${status})`;
    }
    return "Payment verified";
  }

  if (action === PaymentAuditAction.PAYMENT_CONTRIBUTION_CREATED) {
    const outcome = typeof metadata?.outcome === "string" ? metadata.outcome : null;
    const paymentReference =
      typeof metadata?.paymentReference === "string" ? metadata.paymentReference : null;
    const contributionType =
      typeof metadata?.contributionType === "string" ? metadata.contributionType : null;
    const month = typeof metadata?.month === "number" ? metadata.month : null;
    const year = typeof metadata?.year === "number" ? metadata.year : null;
    const typeLabel = contributionType
      ? formatContributionTypeLabel(contributionType)
      : "Contribution";
    const periodLabel =
      month != null && year != null
        ? new Intl.DateTimeFormat("en-GH", {
            month: "long",
            year: "numeric",
          }).format(new Date(year, month - 1, 1))
        : null;

    if (outcome === "duplicate_monthly_dues_skipped") {
      if (periodLabel) {
        return `${periodLabel} contribution skipped — already paid.`;
      }
      if (paymentReference) {
        return `${typeLabel} contribution skipped — member already paid for this month (payment ${paymentReference})`;
      }
    }

    if (outcome === "created" && periodLabel) {
      return `Paid ${periodLabel} contribution.`;
    }

    if (paymentReference) {
      return `${typeLabel} contribution created from payment ${paymentReference}`;
    }

    return `${typeLabel} contribution created from payment`;
  }

  if (
    action === ReceiptAuditAction.RECEIPT_GENERATED ||
    action === ReceiptAuditAction.RECEIPT_DOWNLOADED ||
    action === ReceiptAuditAction.RECEIPT_CANCELLED
  ) {
    const receiptNumber =
      typeof metadata?.receiptNumber === "string" ? metadata.receiptNumber : null;
    if (receiptNumber) {
      if (action === ReceiptAuditAction.RECEIPT_GENERATED) {
        return `Receipt ${receiptNumber} generated`;
      }
      if (action === ReceiptAuditAction.RECEIPT_DOWNLOADED) {
        return `Receipt ${receiptNumber} downloaded`;
      }
      return `Receipt ${receiptNumber} cancelled`;
    }
  }

  if (typeof metadata?.serviceNumber === "string") {
    return `Service number ${metadata.serviceNumber}`;
  }

  return formatAuditActionLabel(action);
}
