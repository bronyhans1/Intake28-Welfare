export const UserRole = {
  ADMIN: "admin",
  TREASURER: "treasurer",
  MEMBER: "member",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
  DEACTIVATED: "deactivated",
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const ActivationStatus = {
  PENDING: "pending",
  ACTIVATED: "activated",
} as const;

export type ActivationStatus =
  (typeof ActivationStatus)[keyof typeof ActivationStatus];

export const Gender = {
  MALE: "male",
  FEMALE: "female",
} as const;

export type Gender = (typeof Gender)[keyof typeof Gender];

export const ContributionType = {
  MONTHLY_DUES: "monthly_dues",
  SPECIAL_CONTRIBUTION: "special_contribution",
  WELFARE_FUND: "welfare_fund",
  OTHER: "other",
} as const;

export type ContributionType =
  (typeof ContributionType)[keyof typeof ContributionType];

export const CONTRIBUTION_TYPE_LABELS: Record<ContributionType, string> = {
  [ContributionType.MONTHLY_DUES]: "Monthly Dues",
  [ContributionType.SPECIAL_CONTRIBUTION]: "Special Contribution",
  [ContributionType.WELFARE_FUND]: "Welfare Fund",
  [ContributionType.OTHER]: "Other",
};

export const ContributionSource = {
  MANUAL: "manual",
  PAYSTACK: "paystack",
} as const;

export type ContributionSource =
  (typeof ContributionSource)[keyof typeof ContributionSource];

export const CONTRIBUTION_SOURCE_LABELS: Record<ContributionSource, string> = {
  [ContributionSource.MANUAL]: "Manual",
  [ContributionSource.PAYSTACK]: "Paystack",
};

export const ContributionStatus = {
  PENDING: "pending",
  PAID: "paid",
  WAIVED: "waived",
  CANCELLED: "cancelled",
} as const;

export type ContributionStatus =
  (typeof ContributionStatus)[keyof typeof ContributionStatus];

export const CONTRIBUTION_STATUS_LABELS: Record<ContributionStatus, string> = {
  [ContributionStatus.PENDING]: "Pending",
  [ContributionStatus.PAID]: "Paid",
  [ContributionStatus.WAIVED]: "Waived",
  [ContributionStatus.CANCELLED]: "Cancelled",
};

export const PaymentProvider = {
  PAYSTACK: "paystack",
  MANUAL: "manual",
} as const;

export type PaymentProvider =
  (typeof PaymentProvider)[keyof typeof PaymentProvider];

export const PaymentMethod = {
  MOBILE_MONEY: "mobile_money",
  BANK_CARD: "bank_card",
  BANK_TRANSFER: "bank_transfer",
  CASH: "cash",
  CHEQUE: "cheque",
  OTHER: "other",
} as const;

export type PaymentMethod =
  (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.MOBILE_MONEY]: "Mobile Money",
  [PaymentMethod.BANK_CARD]: "Bank Card",
  [PaymentMethod.BANK_TRANSFER]: "Bank Transfer",
  [PaymentMethod.CASH]: "Cash",
  [PaymentMethod.CHEQUE]: "Cheque",
  [PaymentMethod.OTHER]: "Other",
};

export const PaymentStatus = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
  ABANDONED: "abandoned",
} as const;

export type PaymentStatus =
  (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: "Pending",
  [PaymentStatus.SUCCESS]: "Success",
  [PaymentStatus.FAILED]: "Failed",
  [PaymentStatus.ABANDONED]: "Abandoned",
};

/**
 * Unified financial ledger category — Payments module source of truth.
 * Add future values here (refund, donation, welfare_fee, miscellaneous) without redesign.
 */
export const PaymentCategory = {
  CONTRIBUTION: "contribution",
  CLAIM: "claim",
  SPECIAL_CONTRIBUTION: "special_contribution",
} as const;

export type PaymentCategory =
  (typeof PaymentCategory)[keyof typeof PaymentCategory];

export const PAYMENT_CATEGORY_LABELS: Record<PaymentCategory, string> = {
  [PaymentCategory.CONTRIBUTION]: "Contribution",
  [PaymentCategory.CLAIM]: "Claim Payment",
  [PaymentCategory.SPECIAL_CONTRIBUTION]: "Special Contribution",
};

export const PaymentType = {
  MONTHLY_DUES: "monthly_dues",
  SPECIAL_CONTRIBUTION: "special_contribution",
  OTHER: "other",
  CLAIM_PAYMENT: "claim_payment",
} as const;

export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  [PaymentType.MONTHLY_DUES]: "Monthly Dues",
  [PaymentType.SPECIAL_CONTRIBUTION]: "Special Contribution",
  [PaymentType.OTHER]: "Other",
  [PaymentType.CLAIM_PAYMENT]: "Claim Payment",
};

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  [PaymentProvider.PAYSTACK]: "Paystack",
  [PaymentProvider.MANUAL]: "Manual",
};

export const WelfareSupportType = {
  FUNERAL: "funeral",
  WEDDING: "wedding",
  NAMING: "naming",
  MEDICAL: "medical",
  EDUCATION: "education",
  EMERGENCY: "emergency",
  BEREAVEMENT: "bereavement",
  OTHER: "other",
} as const;

export type WelfareSupportType =
  (typeof WelfareSupportType)[keyof typeof WelfareSupportType];

export const WELFARE_SUPPORT_TYPE_LABELS: Record<WelfareSupportType, string> = {
  funeral: "Funeral Support",
  wedding: "Wedding Support",
  naming: "Naming Ceremony Support",
  medical: "Medical Assistance",
  education: "Education Support",
  emergency: "Emergency Support",
  bereavement: "Bereavement Support",
  other: "Other",
};

export const WelfareSupportStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  PAID: "paid",
  CANCELLED: "cancelled",
} as const;

export type WelfareSupportStatus =
  (typeof WelfareSupportStatus)[keyof typeof WelfareSupportStatus];

export const AuditAction = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  ACTIVATE: "activate",
  DEACTIVATE: "deactivate",
  IMPORT: "import",
  PAYMENT: "payment",
  LOGIN: "login",
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const AnnouncementAudience = {
  ALL_MEMBERS: "all_members",
  ACTIVE_MEMBERS: "active_members",
  DEFAULTERS: "defaulters",
  TREASURERS: "treasurers",
  ADMINS: "admins",
} as const;

export type AnnouncementAudience =
  (typeof AnnouncementAudience)[keyof typeof AnnouncementAudience];

export const ANNOUNCEMENT_AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  [AnnouncementAudience.ALL_MEMBERS]: "All Members",
  [AnnouncementAudience.ACTIVE_MEMBERS]: "Active Members",
  [AnnouncementAudience.DEFAULTERS]: "Defaulters",
  [AnnouncementAudience.TREASURERS]: "Treasurers",
  [AnnouncementAudience.ADMINS]: "Administrators",
};

export const AnnouncementStatus = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export type AnnouncementStatus =
  (typeof AnnouncementStatus)[keyof typeof AnnouncementStatus];

export const ANNOUNCEMENT_STATUS_LABELS: Record<AnnouncementStatus, string> = {
  [AnnouncementStatus.DRAFT]: "Draft",
  [AnnouncementStatus.PUBLISHED]: "Published",
  [AnnouncementStatus.ARCHIVED]: "Archived",
};

export const SettingsCurrency = {
  GHS: "GHS",
} as const;

export type SettingsCurrency =
  (typeof SettingsCurrency)[keyof typeof SettingsCurrency];

export const SETTINGS_CURRENCY_LABELS: Record<SettingsCurrency, string> = {
  [SettingsCurrency.GHS]: "GHS — Ghana Cedi",
};

/** Membership Claims — Phase 1–6 statuses (payment workflow active from Phase 6) */
export const ClaimStatus = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  NEEDS_REVISION: "needs_revision",
  UNDER_REVIEW: "under_review",
  RECOMMENDED: "recommended",
  MORE_INFORMATION_REQUIRED: "more_information_required",
  APPROVED: "approved",
  REJECTED: "rejected",
  AWAITING_PAYMENT: "awaiting_payment",
  PAYMENT_PROCESSING: "payment_processing",
  /** @deprecated Prefer AWAITING_PAYMENT — retained for any legacy reserved usage */
  PAYMENT_PENDING: "payment_pending",
  PAID: "paid",
  CLOSED: "closed",
  WITHDRAWN: "withdrawn",
} as const;

export type ClaimStatus = (typeof ClaimStatus)[keyof typeof ClaimStatus];

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  [ClaimStatus.DRAFT]: "Draft",
  [ClaimStatus.SUBMITTED]: "Submitted",
  [ClaimStatus.NEEDS_REVISION]: "Needs Revision",
  [ClaimStatus.UNDER_REVIEW]: "Under Review",
  [ClaimStatus.RECOMMENDED]: "Recommended",
  [ClaimStatus.MORE_INFORMATION_REQUIRED]: "More Information Required",
  [ClaimStatus.APPROVED]: "Approved",
  [ClaimStatus.REJECTED]: "Rejected",
  [ClaimStatus.AWAITING_PAYMENT]: "Awaiting Payment",
  [ClaimStatus.PAYMENT_PROCESSING]: "Payment Processing",
  [ClaimStatus.PAYMENT_PENDING]: "Awaiting Payment",
  [ClaimStatus.PAID]: "Paid",
  [ClaimStatus.CLOSED]: "Closed",
  [ClaimStatus.WITHDRAWN]: "Withdrawn",
};

export const ClaimCommentVisibility = {
  INTERNAL: "internal",
  MEMBER_VISIBLE: "member_visible",
} as const;

export type ClaimCommentVisibility =
  (typeof ClaimCommentVisibility)[keyof typeof ClaimCommentVisibility];

export const ClaimAmountMode = {
  FIXED: "fixed",
  FORMULA: "formula",
  MANUAL: "manual",
} as const;

export type ClaimAmountMode =
  (typeof ClaimAmountMode)[keyof typeof ClaimAmountMode];

export const CLAIM_AMOUNT_MODE_LABELS: Record<ClaimAmountMode, string> = {
  [ClaimAmountMode.FIXED]: "Fixed Amount",
  [ClaimAmountMode.FORMULA]: "Percentage of Contribution",
  [ClaimAmountMode.MANUAL]: "Executive Decision",
};

export const ConstitutionStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  RETIRED: "retired",
} as const;

export type ConstitutionStatus =
  (typeof ConstitutionStatus)[keyof typeof ConstitutionStatus];

export const CONSTITUTION_STATUS_LABELS: Record<ConstitutionStatus, string> = {
  [ConstitutionStatus.DRAFT]: "Draft",
  [ConstitutionStatus.ACTIVE]: "Active",
  [ConstitutionStatus.RETIRED]: "Retired",
};

/**
 * Welfare participation status derived from contribution history
 * (distinct from account UserStatus).
 */
export const MembershipProgressionStatus = {
  ACTIVE: "ACTIVE",
  DEFAULTING: "DEFAULTING",
  LAPSED: "LAPSED",
} as const;

export type MembershipProgressionStatus =
  (typeof MembershipProgressionStatus)[keyof typeof MembershipProgressionStatus];

export const MEMBERSHIP_PROGRESSION_STATUS_LABELS: Record<
  MembershipProgressionStatus,
  string
> = {
  [MembershipProgressionStatus.ACTIVE]: "Active",
  [MembershipProgressionStatus.DEFAULTING]: "Defaulting",
  [MembershipProgressionStatus.LAPSED]: "Lapsed",
};

export const DuplicateRuleMode = {
  NONE: "none",
  PREVENT: "prevent",
  WARN: "warn",
} as const;

export type DuplicateRuleMode =
  (typeof DuplicateRuleMode)[keyof typeof DuplicateRuleMode];
