import type { WelfareSupportStatus } from "@/types/enums";
export type WelfareHistorySource = "welfare_support" | "claim_payment";

export interface WelfareHistoryEntry {
  /** Stable row id for React keys — `ws:{id}` or `cp:{paymentId}` */
  id: string;
  source: WelfareHistorySource;
  memberId: string;
  memberName: string;
  serviceNumber: string;
  /** Claim type display name or welfare support type label */
  benefitTypeLabel: string;
  amount: number;
  /** Human-readable status label */
  statusLabel: string;
  recordedByName: string;
  /** Sort/display timestamp (ISO string) */
  occurredAt: string;
  /** Standalone welfare support record id */
  welfareSupportId?: string;
  /** Claim disbursement fields */
  claimId?: string | null;
  claimNumber?: string | null;
  paymentId?: string;
  reference?: string | null;
  description?: string | null;
  /** Welfare support type code or claim type code for filtering */
  benefitTypeCode?: string;
  /** Welfare support type code (standalone only) */
  supportTypeCode?: string;
  /** Raw welfare support status (standalone only) */
  welfareSupportStatus?: WelfareSupportStatus;
}

export interface WelfareHistoryListResult {
  entries: WelfareHistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
