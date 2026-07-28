/**
 * Claim lifecycle audit history — append-only structured events on each claim.
 * This is the permanent source of truth for claim lifecycle actions (Phase 4A).
 * Phase 4B renders this history via the reusable ActivityTimeline component.
 */

import type { CurrentUser } from "@/types/auth";
import type { ClaimLifecycleAuditEvent } from "@/types/claims";

export const ClaimLifecycleAuditType = {
  CLAIM_CREATED: "CLAIM_CREATED",
  CLAIM_SUBMITTED: "CLAIM_SUBMITTED",
  CLAIM_RETURNED_FOR_REVISION: "CLAIM_RETURNED_FOR_REVISION",
  CLAIM_RESUBMITTED: "CLAIM_RESUBMITTED",
  EXECUTIVE_ASSIGNED: "EXECUTIVE_ASSIGNED",
  CLAIM_UNDER_REVIEW: "CLAIM_UNDER_REVIEW",
  EXECUTIVE_COMMENT_ADDED: "EXECUTIVE_COMMENT_ADDED",
  CLAIM_RECOMMENDED: "CLAIM_RECOMMENDED",
  CLAIM_APPROVED: "CLAIM_APPROVED",
  CLAIM_REJECTED: "CLAIM_REJECTED",
  CLAIM_SENT_TO_FINANCE: "CLAIM_SENT_TO_FINANCE",
  PAYMENT_PROCESSING_STARTED: "PAYMENT_PROCESSING_STARTED",
  CLAIM_PAID: "CLAIM_PAID",
} as const;

export type ClaimLifecycleAuditType =
  (typeof ClaimLifecycleAuditType)[keyof typeof ClaimLifecycleAuditType];

export const CLAIM_LIFECYCLE_AUDIT_TITLES: Record<ClaimLifecycleAuditType, string> =
  {
    [ClaimLifecycleAuditType.CLAIM_CREATED]: "Claim Created",
    [ClaimLifecycleAuditType.CLAIM_SUBMITTED]: "Claim Submitted",
    [ClaimLifecycleAuditType.CLAIM_RETURNED_FOR_REVISION]:
      "Claim Returned for Revision",
    [ClaimLifecycleAuditType.CLAIM_RESUBMITTED]: "Claim Resubmitted",
    [ClaimLifecycleAuditType.EXECUTIVE_ASSIGNED]: "Executive Assigned",
    [ClaimLifecycleAuditType.CLAIM_UNDER_REVIEW]: "Review Started",
    [ClaimLifecycleAuditType.EXECUTIVE_COMMENT_ADDED]: "Executive Comment Added",
    [ClaimLifecycleAuditType.CLAIM_RECOMMENDED]: "Claim Recommended",
    [ClaimLifecycleAuditType.CLAIM_APPROVED]: "Claim Approved",
    [ClaimLifecycleAuditType.CLAIM_REJECTED]: "Claim Rejected",
    [ClaimLifecycleAuditType.CLAIM_SENT_TO_FINANCE]: "Sent to Finance",
    [ClaimLifecycleAuditType.PAYMENT_PROCESSING_STARTED]:
      "Payment Processing Started",
    [ClaimLifecycleAuditType.CLAIM_PAID]: "Claim Paid",
  };

export const CLAIM_RETURN_REASON_PRESETS = [
  "Please provide more information.",
  "Incident date requires clarification.",
  "Supporting evidence is unclear.",
  "Description requires clarification.",
  "Other",
] as const;

export type ClaimReturnReasonPreset =
  (typeof CLAIM_RETURN_REASON_PRESETS)[number];

let auditIdCounter = 0;

function nextAuditEventId(now: Date = new Date()): string {
  auditIdCounter += 1;
  return `cae_${now.getTime()}_${auditIdCounter}`;
}

export function buildClaimLifecycleAuditEvent(input: {
  type: ClaimLifecycleAuditType | string;
  title?: string;
  actor: Pick<CurrentUser, "uid" | "fullName" | "role">;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}): ClaimLifecycleAuditEvent {
  const createdAt = input.createdAt ?? new Date();
  const knownTitle =
    input.type in CLAIM_LIFECYCLE_AUDIT_TITLES
      ? CLAIM_LIFECYCLE_AUDIT_TITLES[input.type as ClaimLifecycleAuditType]
      : String(input.type);

  return {
    id: nextAuditEventId(createdAt),
    type: input.type,
    title: input.title ?? knownTitle,
    performedByUserId: input.actor.uid,
    performedByName: input.actor.fullName,
    performedByRole: input.actor.role,
    createdAt: createdAt.toISOString(),
    reason: input.reason?.trim() ? input.reason.trim() : null,
    metadata: input.metadata ?? {},
  };
}

/**
 * Append-only merge: never removes or mutates prior events.
 * Returns a new array in chronological order (oldest → newest).
 */
export function appendClaimLifecycleAuditHistory(
  existing: ClaimLifecycleAuditEvent[] | null | undefined,
  event: ClaimLifecycleAuditEvent,
): ClaimLifecycleAuditEvent[] {
  const history = Array.isArray(existing) ? [...existing] : [];
  history.push(event);
  return sortClaimLifecycleAuditHistory(history);
}

export function sortClaimLifecycleAuditHistory(
  events: ClaimLifecycleAuditEvent[],
): ClaimLifecycleAuditEvent[] {
  return [...events].sort((a, b) => {
    const aTime = Date.parse(a.createdAt) || 0;
    const bTime = Date.parse(b.createdAt) || 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.id.localeCompare(b.id);
  });
}

export function getSortedClaimAuditHistory(
  claim: { auditHistory?: ClaimLifecycleAuditEvent[] | null },
): ClaimLifecycleAuditEvent[] {
  return sortClaimLifecycleAuditHistory(claim.auditHistory ?? []);
}

export function resolveReturnReason(input: {
  reasonPreset: string;
  customReason?: string | null;
}): string {
  const preset = input.reasonPreset.trim();
  const custom = input.customReason?.trim() ?? "";

  if (preset === "Other") {
    if (!custom) {
      throw new Error("A custom return reason is required when Other is selected.");
    }
    return custom;
  }

  if (!preset) {
    throw new Error("A return reason is required.");
  }

  return custom ? `${preset} ${custom}`.trim() : preset;
}
