import { z } from "zod";
import {
  ClaimAmountMode,
  ClaimCommentVisibility,
  ClaimStatus,
  ConstitutionStatus,
  DuplicateRuleMode,
} from "@/types/enums";

const CLAIM_AMOUNT_MODES = [
  ClaimAmountMode.FIXED,
  ClaimAmountMode.FORMULA,
  ClaimAmountMode.MANUAL,
] as const;

const DUPLICATE_MODES = [
  DuplicateRuleMode.NONE,
  DuplicateRuleMode.PREVENT,
  DuplicateRuleMode.WARN,
] as const;

const claimTypeCodeSchema = z
  .string()
  .trim()
  .min(2, "Internal ID is required")
  .max(64, "Internal ID is too long")
  .regex(
    /^[a-z][a-z0-9_]*$/,
    "Use lowercase letters, numbers, and underscores (e.g. medical_support)",
  );

export const createClaimDraftSchema = z.object({
  claimTypeCode: claimTypeCodeSchema,
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(5000),
  incidentDate: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  whatsappEvidenceNote: z
    .string()
    .trim()
    .max(500, "WhatsApp evidence note is too long")
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  attachmentUrl: z
    .string()
    .url()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  attachmentPath: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  attachmentFileName: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  attachmentContentType: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  /** Kept for backward compatibility with older drafts; not shown in Phase 3 form */
  requestedAmount: z
    .number()
    .positive("Amount must be greater than 0")
    .finite()
    .optional()
    .nullable(),
});

export type CreateClaimDraftInput = z.infer<typeof createClaimDraftSchema>;

export const updateClaimDraftSchema = createClaimDraftSchema;

export type UpdateClaimDraftInput = z.infer<typeof updateClaimDraftSchema>;

export const submitClaimSchema = z.object({
  claimId: z.string().trim().min(1, "Claim id is required"),
});

export type SubmitClaimInput = z.infer<typeof submitClaimSchema>;

export const updateClaimRevisionSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(5000),
  incidentDate: z
    .string()
    .trim()
    .min(1, "Incident date is required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
  whatsappEvidenceNote: z
    .string()
    .trim()
    .max(500, "WhatsApp evidence note is too long")
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  attachmentUrl: z
    .string()
    .url()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  attachmentPath: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  attachmentFileName: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  attachmentContentType: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
});

export type UpdateClaimRevisionInput = z.infer<typeof updateClaimRevisionSchema>;

export const returnClaimForRevisionSchema = z
  .object({
    claimId: z.string().trim().min(1, "Claim id is required"),
    reasonPreset: z.enum([
      "Please provide more information.",
      "Incident date requires clarification.",
      "Supporting evidence is unclear.",
      "Description requires clarification.",
      "Other",
    ]),
    customReason: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .nullable()
      .transform((value) => (value ? value : null)),
  })
  .superRefine((value, ctx) => {
    if (value.reasonPreset === "Other" && !value.customReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a custom return reason.",
        path: ["customReason"],
      });
    }
  });

export type ReturnClaimForRevisionInput = z.infer<
  typeof returnClaimForRevisionSchema
>;

export const resubmitClaimSchema = z.object({
  claimId: z.string().trim().min(1, "Claim id is required"),
});

export type ResubmitClaimInput = z.infer<typeof resubmitClaimSchema>;

export const claimDraftListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(10),
  search: z.string().optional(),
  claimTypeCode: z.string().optional(),
  status: z
    .enum([
      ClaimStatus.DRAFT,
      ClaimStatus.SUBMITTED,
      ClaimStatus.NEEDS_REVISION,
    ])
    .optional(),
});

export type ClaimDraftListQuery = z.infer<typeof claimDraftListQuerySchema>;

const EXECUTIVE_DASHBOARD_STATUS_VALUES = [
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

const FINANCE_CLAIM_STATUS_VALUES = [
  ClaimStatus.AWAITING_PAYMENT,
  ClaimStatus.PAYMENT_PROCESSING,
  ClaimStatus.PAID,
] as const;

const CLAIM_PAYMENT_METHODS = [
  "mobile_money",
  "bank_transfer",
  "cash",
  "cheque",
  "other",
] as const;

export const submittedClaimsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(EXECUTIVE_DASHBOARD_STATUS_VALUES).optional(),
  sortBy: z
    .enum([
      "submissionDate",
      "claimNumber",
      "claimType",
      "memberName",
    ])
    .default("submissionDate"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type SubmittedClaimsListQuery = z.infer<
  typeof submittedClaimsListQuerySchema
>;

export const startClaimReviewSchema = z.object({
  claimId: z.string().trim().min(1, "Claim id is required"),
});

export type StartClaimReviewInput = z.infer<typeof startClaimReviewSchema>;

export const addExecutiveCommentSchema = z.object({
  claimId: z.string().trim().min(1, "Claim id is required"),
  body: z
    .string()
    .trim()
    .min(1, "Comment is required")
    .max(2000, "Comment is too long"),
  visibility: z.enum([
    ClaimCommentVisibility.INTERNAL,
    ClaimCommentVisibility.MEMBER_VISIBLE,
  ]),
});

export type AddExecutiveCommentInput = z.infer<typeof addExecutiveCommentSchema>;

export const recommendClaimSchema = z.object({
  claimId: z.string().trim().min(1, "Claim id is required"),
});

export type RecommendClaimInput = z.infer<typeof recommendClaimSchema>;

export const approveClaimSchema = z
  .object({
    claimId: z.string().trim().min(1, "Claim id is required"),
    decision: z.enum([
      "recommended",
      "reduced",
      "full_ceiling",
      "full_ceiling_plus_bonus",
    ]),
    approvedAmount: z.coerce.number().positive().optional(),
    bonusAmount: z.coerce.number().positive().optional(),
    overrideReason: z
      .string()
      .trim()
      .max(2000, "Override reason is too long")
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "recommended") {
      return;
    }
    if (!value.overrideReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A reason is required for this approval decision.",
        path: ["overrideReason"],
      });
    }
    if (value.decision === "reduced" && !(value.approvedAmount && value.approvedAmount > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter the reduced approved amount.",
        path: ["approvedAmount"],
      });
    }
    if (
      value.decision === "full_ceiling_plus_bonus" &&
      !(value.bonusAmount && value.bonusAmount > 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a bonus amount greater than zero.",
        path: ["bonusAmount"],
      });
    }
  });

export type ApproveClaimInput = z.infer<typeof approveClaimSchema>;

export const rejectClaimSchema = z.object({
  claimId: z.string().trim().min(1, "Claim id is required"),
  rejectionReason: z
    .string()
    .trim()
    .min(1, "Rejection reason is required")
    .max(2000, "Rejection reason is too long"),
});

export type RejectClaimInput = z.infer<typeof rejectClaimSchema>;

export const assignClaimExecutiveSchema = z.object({
  claimId: z.string().trim().min(1, "Claim id is required"),
  assignedExecutiveId: z
    .string()
    .trim()
    .min(1, "Assigned executive is required"),
});

export type AssignClaimExecutiveInput = z.infer<
  typeof assignClaimExecutiveSchema
>;

export const startClaimPaymentProcessingSchema = z.object({
  claimId: z.string().trim().min(1, "Claim id is required"),
});

export type StartClaimPaymentProcessingInput = z.infer<
  typeof startClaimPaymentProcessingSchema
>;

export const completeClaimPaymentSchema = z
  .object({
    claimId: z.string().trim().min(1, "Claim id is required"),
    amount: z.coerce
      .number()
      .positive("Payment amount must be greater than zero")
      .finite(),
    paymentDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
    paymentMethod: z.enum(CLAIM_PAYMENT_METHODS),
    referenceNumber: z
      .string()
      .trim()
      .max(120)
      .optional()
      .nullable()
      .transform((value) => (value ? value : null)),
    financeNotes: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .nullable()
      .transform((value) => (value ? value : null)),
    amountReductionReason: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .nullable()
      .transform((value) => (value ? value : null)),
  });

export type CompleteClaimPaymentInput = z.infer<
  typeof completeClaimPaymentSchema
>;

export const financeClaimsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(FINANCE_CLAIM_STATUS_VALUES).optional(),
  sortBy: z
    .enum([
      "claimNumber",
      "memberName",
      "amount",
      "paymentDate",
      "paymentMethod",
    ])
    .default("claimNumber"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export type FinanceClaimsListQuery = z.infer<
  typeof financeClaimsListQuerySchema
>;

const documentRequirementSchema = z.object({
  code: z.string().trim().min(1),
  label: z.string().trim().min(1),
  description: z.string().optional(),
  required: z.boolean(),
  acceptedMimeTypes: z.array(z.string()).optional(),
  maxSizeBytes: z.number().int().positive().optional(),
});

const checklistTemplateItemSchema = z.object({
  itemId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  description: z.string().optional(),
  category: z.enum([
    "eligibility",
    "document",
    "review",
    "approval",
    "payment",
  ]),
  sortOrder: z.number().int(),
  required: z.boolean(),
  autoEvaluate: z.boolean().optional(),
  evaluationKey: z.string().optional(),
});

const eligibilityCheckSchema = z.object({
  checkId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  blocking: z.boolean(),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

const duplicateRulesSchema = z.object({
  mode: z.enum(DUPLICATE_MODES),
  scope: z.enum(["member", "member_and_subject", "member_and_type"]),
  subjectKey: z.string().optional(),
  matchFields: z.array(z.string()).optional(),
  openStatuses: z.array(z.string()).optional(),
  allowIfIncidentDatesDiffer: z.boolean().optional(),
  lifetimeLimit: z.number().int().positive().optional(),
  maxOpenClaims: z.number().int().positive().optional(),
  message: z.string().optional(),
});

export const createClaimTypeConfigSchema = z.object({
  code: claimTypeCodeSchema,
  displayName: z.string().trim().min(1, "Claim name is required").max(120),
  description: z
    .string()
    .trim()
    .max(2000, "Description is too long")
    .optional()
    .transform((value) => value ?? ""),
  active: z.boolean().default(true),
  requiresExecutiveApproval: z.boolean().default(true),
  requiresTreasurerPayment: z.boolean().default(true),
  amountMode: z.enum(CLAIM_AMOUNT_MODES),
  fixedAmount: z.number().positive().finite().nullable().optional(),
  formulaKey: z.string().trim().nullable().optional(),
  waitingPeriodDays: z
    .number()
    .int("Waiting period must be a whole number of days")
    .min(0, "Waiting period cannot be negative")
    .max(3650, "Waiting period is too long"),
  benefitPercentage: z
    .number()
    .min(0, "Benefit percentage cannot be negative")
    .max(100, "Benefit percentage cannot exceed 100"),
  allowDrafts: z.boolean().default(true),
  maxDocuments: z.number().int().min(0).max(50).default(10),
  requiredDocuments: z.array(documentRequirementSchema).default([]),
  eligibilityChecks: z.array(eligibilityCheckSchema).default([]),
  checklist: z.array(checklistTemplateItemSchema).default([]),
  notifications: z
    .object({
      enabledEvents: z.array(z.string()).optional(),
      suppressMemberEvents: z.array(z.string()).optional(),
    })
    .default({}),
  allowMultipleOpenClaims: z.boolean().default(true),
  duplicateRules: duplicateRulesSchema.default({
    mode: DuplicateRuleMode.NONE,
    scope: "member_and_type",
  }),
  sortOrder: z.number().int().default(100),
});

export type CreateClaimTypeConfigInput = z.infer<
  typeof createClaimTypeConfigSchema
>;

export const updateClaimTypeConfigSchema = createClaimTypeConfigSchema.omit({
  code: true,
});

export type UpdateClaimTypeConfigInput = z.infer<
  typeof updateClaimTypeConfigSchema
>;

export const claimTypeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  search: z.string().optional(),
  active: z
    .enum(["true", "false", "all"])
    .optional()
    .transform((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return undefined;
    }),
});

export type ClaimTypeListQuery = z.infer<typeof claimTypeListQuerySchema>;

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format");

export const createConstitutionDraftSchema = z.object({
  /** Optional — auto-generated as constitution_vN when omitted */
  id: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "Use lowercase letters, numbers, and underscores (e.g. constitution_v1)",
    )
    .optional(),
  displayName: z.string().trim().min(1, "Constitution title is required").max(200),
  versionNumber: z.string().trim().min(1, "Version number is required").max(40),
  effectiveFrom: isoDateSchema,
  effectiveTo: isoDateSchema.nullable().optional(),
  description: z.string().trim().min(1, "Description is required").max(5000),
  notes: z.string().trim().max(5000).nullable().optional(),
  /** Optional — auto-generated from the constitution id when omitted */
  rulesetVersion: z.string().trim().max(80).optional(),
  documentRef: z.string().trim().max(2000).nullable().optional(),
  supersedesId: z.string().trim().nullable().optional(),
  /** When true and a document is attached, activate this version for members */
  publishAsActive: z.boolean().optional().default(false),
});

export type CreateConstitutionDraftInput = z.infer<
  typeof createConstitutionDraftSchema
>;

export const updateConstitutionDraftSchema = createConstitutionDraftSchema.omit({
  id: true,
});

export type UpdateConstitutionDraftInput = z.infer<
  typeof updateConstitutionDraftSchema
>;

export const constitutionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  search: z.string().optional(),
  /** Phase 1: drafts only in practice; filter still accepts draft explicitly */
  status: z.literal(ConstitutionStatus.DRAFT).optional(),
});

export type ConstitutionListQuery = z.infer<typeof constitutionListQuerySchema>;
