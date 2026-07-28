import type { Timestamp } from "firebase/firestore";
import type {
  ClaimAmountMode,
  ClaimStatus,
  ConstitutionStatus,
  DuplicateRuleMode,
} from "./enums";

/** Document requirement on a claim type config (Phase 1 storage; enforced later) */
export interface ClaimDocumentRequirement {
  code: string;
  label: string;
  description?: string;
  required: boolean;
  acceptedMimeTypes?: string[];
  maxSizeBytes?: number;
}

/** Checklist template item on a claim type (Phase 1 storage; instances later) */
export interface ClaimChecklistTemplateItem {
  itemId: string;
  label: string;
  description?: string;
  category: "eligibility" | "document" | "review" | "approval" | "payment";
  sortOrder: number;
  required: boolean;
  autoEvaluate?: boolean;
  evaluationKey?: string;
}

/** Eligibility check reference on a claim type (evaluated by Rules Engine later) */
export interface ClaimEligibilityCheckRef {
  checkId: string;
  label: string;
  blocking: boolean;
  params?: Record<string, string | number | boolean>;
}

export interface ClaimDuplicateRuleConfig {
  mode: DuplicateRuleMode;
  scope: "member" | "member_and_subject" | "member_and_type";
  subjectKey?: string;
  matchFields?: string[];
  openStatuses?: ClaimStatus[];
  allowIfIncidentDatesDiffer?: boolean;
  lifetimeLimit?: number;
  maxOpenClaims?: number;
  message?: string;
}

export interface ClaimTypeNotificationConfig {
  enabledEvents?: string[];
  suppressMemberEvents?: string[];
}

/**
 * Claim type configuration — administrators manage these without code changes.
 * Phase 1: CRUD only; workflow engines consume these fields in later phases.
 */
export interface ClaimTypeConfig {
  id: string;
  code: string;
  displayName: string;
  description: string;
  active: boolean;
  requiresExecutiveApproval: boolean;
  requiresTreasurerPayment: boolean;
  amountMode: ClaimAmountMode;
  fixedAmount?: number | null;
  formulaKey?: string | null;
  /**
   * Minimum membership days before a member may submit this claim type.
   * Read by the Eligibility Engine — not hardcoded in application logic.
   */
  waitingPeriodDays: number;
  /**
   * Configured benefit percentage for this claim type (e.g. 75).
   * Returned by the Eligibility Engine for reference only — no money calculation.
   */
  benefitPercentage: number;
  allowDrafts: boolean;
  maxDocuments: number;
  requiredDocuments: ClaimDocumentRequirement[];
  eligibilityChecks: ClaimEligibilityCheckRef[];
  checklist: ClaimChecklistTemplateItem[];
  notifications: ClaimTypeNotificationConfig;
  allowMultipleOpenClaims: boolean;
  duplicateRules: ClaimDuplicateRuleConfig;
  sortOrder: number;
  configVersion: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  createdByName: string;
  updatedBy?: string;
  updatedByName?: string;
}

export type SerializedClaimTypeConfig = Omit<
  ClaimTypeConfig,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

/**
 * Membership claim — drafts (Phase 1) and submitted claims (Phase 3).
 * Later phases add governanceSnapshot, executiveDecision, payments, etc.
 */
export interface ClaimEligibilitySnapshot {
  eligible: boolean;
  reasons: string[];
  warnings: string[];
  memberStatus: string;
  constitutionVersion: string;
  benefitPercentage: number;
  checkedAt: string;
}

/**
 * Immutable progression snapshot captured at claim submission (Phase 3B).
 * Never recalculated after submission.
 */
export interface ClaimProgressionSnapshot {
  welfarePoints: number;
  benefitPercentage: number;
  membershipStatus: string;
  isMature: boolean;
  eligibleToClaim: boolean;
  recommendedAmount: number;
  claimCeiling: number;
  calculatedAt: string;
}

/**
 * Structured claim lifecycle audit event (append-only on the claim document).
 * Architecture supports future event types without schema breaking changes.
 */
export interface ClaimLifecycleAuditEvent {
  id: string;
  type: string;
  title: string;
  performedByUserId: string;
  performedByName: string;
  performedByRole: string;
  createdAt: string;
  reason: string | null;
  metadata: Record<string, unknown>;
}

/** Append-only executive review comment (Phase 5) */
export interface ClaimExecutiveComment {
  id: string;
  body: string;
  visibility: "internal" | "member_visible";
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
}

export interface Claim {
  id: string;
  /**
   * Display reference: provisional `DRAFT-…` while draft;
   * equals permanent `claimNumber` after submission.
   */
  reference: string;
  /** Permanent claim number after submission, e.g. GIS-2026-00001. Never changes. */
  claimNumber?: string | null;
  memberId: string;
  memberName: string;
  serviceNumber: string;
  claimTypeCode: string;
  claimTypeDisplayName: string;
  status: ClaimStatus;
  title: string;
  description: string;
  incidentDate?: string | null;
  requestedAmount?: number | null;
  /** Free-text note only — no WhatsApp integration */
  whatsappEvidenceNote?: string | null;
  attachmentUrl?: string | null;
  attachmentPath?: string | null;
  attachmentFileName?: string | null;
  attachmentContentType?: string | null;
  currency: "GHS";
  /** Snapshot of eligibility at submission / resubmission (admin review reference) */
  eligibilitySnapshot?: ClaimEligibilitySnapshot | null;
  /**
   * Immutable progression snapshot at submission (Phase 3B).
   * Welfare points, benefit %, status, maturity, recommended amount.
   */
  progressionSnapshot?: ClaimProgressionSnapshot | null;
  /**
   * Recommended benefit amount (GHS) from ceiling × progression benefit %.
   * Members cannot edit this value.
   */
  recommendedAmount?: number | null;
  /** Claim-type ceiling used for the recommendation (GHS). */
  claimCeiling?: number | null;
  /** Append-only structured lifecycle audit history */
  auditHistory?: ClaimLifecycleAuditEvent[];
  /** Append-only executive comments */
  executiveComments?: ClaimExecutiveComment[];
  /**
   * Approved benefit amount (GHS) — Finance payment ceiling / final amount.
   */
  approvedBenefitAmount?: number | null;
  /** Executive-approved amount before bonus (GHS). */
  approvedAmount?: number | null;
  /** Executive bonus amount (GHS), if any. */
  bonusAmount?: number | null;
  /** Final amount after executive decision (GHS). Equals approvedBenefitAmount. */
  finalAmount?: number | null;
  /** Executive approval decision mode */
  approvalDecision?: string | null;
  /** Required when overriding the recommended amount */
  overrideReason?: string | null;
  /**
   * Reference to the Payments ledger record. Payment details live in Payments —
   * never duplicate amount/method/date on the claim.
   */
  paymentId?: string | null;
  submittedAt?: Timestamp | null;
  returnedAt?: Timestamp | null;
  returnedById?: string | null;
  returnedByName?: string | null;
  returnReason?: string | null;
  resubmittedAt?: Timestamp | null;
  resubmittedById?: string | null;
  resubmittedByName?: string | null;
  reviewStartedAt?: Timestamp | null;
  reviewedById?: string | null;
  reviewedByName?: string | null;
  recommendedAt?: Timestamp | null;
  recommendedById?: string | null;
  recommendedByName?: string | null;
  approvedAt?: Timestamp | null;
  approvedById?: string | null;
  approvedByName?: string | null;
  rejectedAt?: Timestamp | null;
  rejectedById?: string | null;
  rejectedByName?: string | null;
  rejectionReason?: string | null;
  financeQueuedAt?: Timestamp | null;
  paymentProcessingAt?: Timestamp | null;
  paymentProcessingById?: string | null;
  paymentProcessingByName?: string | null;
  assignedExecutiveId?: string | null;
  assignedExecutiveName?: string | null;
  assignedAt?: Timestamp | null;
  assignedById?: string | null;
  assignedByName?: string | null;
  createdBy: string;
  createdByName: string;
  updatedBy?: string;
  updatedByName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type SerializedClaim = Omit<
  Claim,
  | "createdAt"
  | "updatedAt"
  | "submittedAt"
  | "returnedAt"
  | "resubmittedAt"
  | "reviewStartedAt"
  | "recommendedAt"
  | "approvedAt"
  | "rejectedAt"
  | "assignedAt"
  | "financeQueuedAt"
  | "paymentProcessingAt"
> & {
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  returnedAt?: string | null;
  resubmittedAt?: string | null;
  reviewStartedAt?: string | null;
  recommendedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  assignedAt?: string | null;
  financeQueuedAt?: string | null;
  paymentProcessingAt?: string | null;
};

/**
 * Welfare Constitution version — Phase 1 allows draft CRUD only.
 * Activate / retire is deferred to a later phase.
 */
export interface ConstitutionVersion {
  id: string;
  displayName: string;
  versionNumber: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: ConstitutionStatus;
  description: string;
  approvedById?: string | null;
  approvedByName?: string | null;
  approvalDate?: string | null;
  notes?: string | null;
  amendmentReason?: string | null;
  rulesetVersion: string;
  documentRef?: string | null;
  supersededById?: string | null;
  supersedesId?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  createdByName: string;
  updatedBy?: string;
  updatedByName?: string;
  activatedAt?: Timestamp | null;
  retiredAt?: Timestamp | null;
}

export type SerializedConstitutionVersion = Omit<
  ConstitutionVersion,
  "createdAt" | "updatedAt" | "activatedAt" | "retiredAt"
> & {
  createdAt: string;
  updatedAt: string;
  activatedAt?: string | null;
  retiredAt?: string | null;
};
