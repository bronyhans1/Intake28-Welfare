import { hasPermission, Permission } from "@/lib/auth/permissions";
import { ClaimCommentVisibility, ClaimStatus } from "@/types/enums";
import type { ClaimExecutiveComment } from "@/types/claims";
import type { UserRole } from "@/types/enums";

/** Member may edit content only in draft or needs-revision. */
export function canMemberEditClaimContent(status: ClaimStatus): boolean {
  return status === ClaimStatus.DRAFT || status === ClaimStatus.NEEDS_REVISION;
}

/** Claim type / claim number are immutable after first submission. */
export function canMemberChangeClaimType(status: ClaimStatus): boolean {
  return status === ClaimStatus.DRAFT;
}

export function canMemberDeleteClaim(status: ClaimStatus): boolean {
  return status === ClaimStatus.DRAFT;
}

/** Statuses shown on the executive claims dashboard. */
export const EXECUTIVE_DASHBOARD_STATUSES: readonly ClaimStatus[] = [
  ClaimStatus.SUBMITTED,
  ClaimStatus.NEEDS_REVISION,
  ClaimStatus.UNDER_REVIEW,
  ClaimStatus.RECOMMENDED,
  ClaimStatus.APPROVED,
  ClaimStatus.REJECTED,
  ClaimStatus.AWAITING_PAYMENT,
  ClaimStatus.PAYMENT_PROCESSING,
  ClaimStatus.PAID,
] as const;

/** Statuses on the Finance claims payment queue. */
export const FINANCE_CLAIM_STATUSES: readonly ClaimStatus[] = [
  ClaimStatus.AWAITING_PAYMENT,
  ClaimStatus.PAYMENT_PROCESSING,
  ClaimStatus.PAID,
] as const;

export function isAdminReviewClaimStatus(status: ClaimStatus): boolean {
  return (EXECUTIVE_DASHBOARD_STATUSES as readonly string[]).includes(status);
}

export function isFinanceClaimStatus(status: ClaimStatus): boolean {
  return (FINANCE_CLAIM_STATUSES as readonly string[]).includes(status);
}

export function canReviewClaims(role: UserRole): boolean {
  return hasPermission(role, Permission.REVIEW_CLAIMS);
}

export function canAssignClaims(role: UserRole): boolean {
  return hasPermission(role, Permission.ASSIGN_CLAIMS);
}

export function canProcessClaimPayments(role: UserRole): boolean {
  return hasPermission(role, Permission.PROCESS_CLAIM_PAYMENTS);
}

export function isTerminalClaimStatus(status: ClaimStatus): boolean {
  return (
    status === ClaimStatus.REJECTED ||
    status === ClaimStatus.PAID ||
    status === ClaimStatus.CLOSED
  );
}

export function canStartClaimReview(status: ClaimStatus): boolean {
  return status === ClaimStatus.SUBMITTED;
}

export function canRecommendClaim(status: ClaimStatus): boolean {
  return status === ClaimStatus.UNDER_REVIEW;
}

export function canApproveClaim(status: ClaimStatus): boolean {
  return (
    status === ClaimStatus.SUBMITTED ||
    status === ClaimStatus.UNDER_REVIEW ||
    status === ClaimStatus.RECOMMENDED
  );
}

export function canRejectClaim(status: ClaimStatus): boolean {
  return canApproveClaim(status);
}

export function canAddExecutiveComment(status: ClaimStatus): boolean {
  return (
    status === ClaimStatus.SUBMITTED ||
    status === ClaimStatus.UNDER_REVIEW ||
    status === ClaimStatus.RECOMMENDED ||
    status === ClaimStatus.NEEDS_REVISION ||
    status === ClaimStatus.AWAITING_PAYMENT ||
    status === ClaimStatus.PAYMENT_PROCESSING
  );
}

export function canAssignClaimExecutive(status: ClaimStatus): boolean {
  return (
    !isTerminalClaimStatus(status) &&
    status !== ClaimStatus.DRAFT &&
    isAdminReviewClaimStatus(status) &&
    status !== ClaimStatus.PAID
  );
}

export function canStartClaimPaymentProcessing(status: ClaimStatus): boolean {
  return status === ClaimStatus.AWAITING_PAYMENT;
}

export function canCompleteClaimPayment(status: ClaimStatus): boolean {
  return status === ClaimStatus.PAYMENT_PROCESSING;
}

export function getMemberVisibleComments(
  comments: ClaimExecutiveComment[] | null | undefined,
): ClaimExecutiveComment[] {
  return (comments ?? []).filter(
    (comment) => comment.visibility === ClaimCommentVisibility.MEMBER_VISIBLE,
  );
}

export function getExecutiveVisibleComments(
  comments: ClaimExecutiveComment[] | null | undefined,
): ClaimExecutiveComment[] {
  return [...(comments ?? [])].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
}

/** Members must not see internal comment audit events on the timeline. */
export function filterAuditHistoryForMemberView<
  T extends { type: string; metadata?: Record<string, unknown> | null },
>(events: T[]): T[] {
  return events.filter((event) => {
    if (event.type !== "EXECUTIVE_COMMENT_ADDED") return true;
    return event.metadata?.visibility === ClaimCommentVisibility.MEMBER_VISIBLE;
  });
}
