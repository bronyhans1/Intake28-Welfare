export const ClaimsAuditAction = {
  CLAIM_DRAFT_CREATED: "claim_draft_created",
  CLAIM_DRAFT_UPDATED: "claim_draft_updated",
  CLAIM_DRAFT_DELETED: "claim_draft_deleted",
  CLAIM_SUBMITTED: "claim_submitted",
  CLAIM_RETURNED_FOR_REVISION: "claim_returned_for_revision",
  CLAIM_RESUBMITTED: "claim_resubmitted",
  CLAIM_REVISION_UPDATED: "claim_revision_updated",
  CLAIM_REVIEW_STARTED: "claim_review_started",
  CLAIM_RECOMMENDED: "claim_recommended",
  CLAIM_APPROVED: "claim_approved",
  CLAIM_REJECTED: "claim_rejected",
  CLAIM_EXECUTIVE_ASSIGNED: "claim_executive_assigned",
  CLAIM_EXECUTIVE_COMMENT_ADDED: "claim_executive_comment_added",
  CLAIM_SENT_TO_FINANCE: "claim_sent_to_finance",
  CLAIM_PAYMENT_PROCESSING_STARTED: "claim_payment_processing_started",
  CLAIM_PAID: "claim_paid",
  CLAIM_TYPE_CREATED: "claim_type_created",
  CLAIM_TYPE_UPDATED: "claim_type_updated",
  CLAIM_TYPE_DELETED: "claim_type_deleted",
  CONSTITUTION_CREATED: "constitution_created",
  CONSTITUTION_UPDATED: "constitution_updated",
  CONSTITUTION_DELETED: "constitution_deleted",
} as const;

export type ClaimsAuditAction =
  (typeof ClaimsAuditAction)[keyof typeof ClaimsAuditAction];
