import type { Timestamp } from "firebase/firestore";
import type {
  PaymentCategory,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PaymentType,
  SettingsCurrency,
} from "./enums";

/**
 * Unified Payments ledger record.
 * Contribution (Paystack) and Claim (manual disbursement) payments share this model.
 * Claim stores only `paymentId` — payment fields live here as source of truth.
 */
export interface Payment {
  id: string;
  memberId: string;
  memberName: string;
  serviceNumber: string;
  email: string;
  amount: number;
  currency: SettingsCurrency;
  reference: string;
  paymentType: PaymentType;
  /**
   * Ledger category for filtering/reporting.
   * Legacy contribution payments may omit this; resolve via paymentType.
   */
  paymentCategory?: PaymentCategory | null;
  provider: PaymentProvider;
  providerReference: string | null;
  status: PaymentStatus;
  /** Disbursement / settlement method (especially claim payments) */
  paymentMethod?: PaymentMethod | null;
  /** Claim link — populated for PaymentCategory.CLAIM only */
  claimId?: string | null;
  claimNumber?: string | null;
  claimTypeCode?: string | null;
  claimTypeDisplayName?: string | null;
  paidById?: string | null;
  paidByName?: string | null;
  /** Internal finance notes — never shown to members */
  financeNotes?: string | null;
  /** Required when paid amount is less than approved benefit */
  amountReductionReason?: string | null;
  /**
   * Selected monthly-dues periods for this payment (Phase 3F arrears).
   * One contribution record is created per period after verification.
   */
  selectedMonths?: Array<{ month: number; year: number }> | null;
  createdAt: Timestamp;
  paidAt: Timestamp | null;
  updatedAt: Timestamp;
}

/** Plain JSON record safe for Server → Client Component props */
export type SerializedPayment = Omit<
  Payment,
  "createdAt" | "updatedAt" | "paidAt"
> & {
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
};

/** Member-safe payment summary (excludes financeNotes) */
export type MemberVisiblePaymentSummary = {
  id: string;
  amount: number;
  currency: SettingsCurrency;
  paymentMethod: PaymentMethod | null;
  paidAt: string | null;
  reference: string;
  status: PaymentStatus;
};

export interface InitializePaymentInput {
  memberId: string;
  amount?: number;
  paymentType: PaymentType;
  /** Required for monthly dues — one or more unpaid months to clear */
  selectedMonths?: Array<{ month: number; year: number }>;
}

export interface InitializePaymentResult {
  reference: string;
  authorizationUrl: string;
}

export interface CreateClaimDisbursementPaymentInput {
  memberId: string;
  memberName: string;
  serviceNumber: string;
  email: string;
  amount: number;
  currency: SettingsCurrency;
  reference: string;
  claimId: string;
  claimNumber: string;
  claimTypeCode: string;
  claimTypeDisplayName: string;
  paymentMethod: PaymentMethod;
  paymentDate: Date;
  financeNotes?: string | null;
  amountReductionReason?: string | null;
  paidById: string;
  paidByName: string;
}
