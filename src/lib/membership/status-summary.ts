import {
  getContributionStats,
  listContributions,
} from "@/lib/contributions/repository";
import { formatContributionTypeLabel } from "@/lib/contributions/labels";
import { getMonthlyDuesPaymentGuardStatus } from "@/lib/payments/monthly-dues-guard";
import { listPayments } from "@/lib/payments/repository";
import { getReceiptStats } from "@/lib/receipts/repository";
import { listWelfareSupport } from "@/lib/welfare/repository";
import type { CurrentUser } from "@/types/auth";

export interface MemberMembershipStatus {
  monthlyDuesPaid: boolean;
  monthlyDuesMessage: string | null;
  monthlyDuesMonth: number;
  monthlyDuesYear: number;
  lastContributionDate: string | null;
  lastContributionAmount: number | null;
  lastContributionTypeLabel: string | null;
  totalContributions: number;
  totalAmountPaid: number;
  paymentCount: number;
  lastPaymentDate: string | null;
  receiptCount: number;
  welfareSupportCount: number;
}

export async function getMemberMembershipStatus(
  memberId: string,
  actor: CurrentUser,
): Promise<MemberMembershipStatus> {
  const [monthlyDues, contributions, stats, payments, receiptStats, welfare] =
    await Promise.all([
    getMonthlyDuesPaymentGuardStatus(memberId),
    listContributions({ memberId, page: 1, pageSize: 1 }),
    getContributionStats({ memberId }),
    listPayments({ page: 1, pageSize: 1, memberId }, actor),
    getReceiptStats({ memberId }),
    listWelfareSupport({ memberId, page: 1, pageSize: 1 }),
  ]);

  const lastContribution = contributions.records[0] ?? null;
  const lastPayment = payments.records[0] ?? null;

  return {
    monthlyDuesPaid: monthlyDues.isPaid,
    monthlyDuesMessage: monthlyDues.message,
    monthlyDuesMonth: monthlyDues.month,
    monthlyDuesYear: monthlyDues.year,
    lastContributionDate: lastContribution?.createdAt ?? null,
    lastContributionAmount: lastContribution?.amount ?? null,
    lastContributionTypeLabel: lastContribution
      ? formatContributionTypeLabel(lastContribution.contributionType)
      : null,
    totalContributions: stats.totalContributions,
    totalAmountPaid: stats.totalAmountCollected,
    paymentCount: payments.total,
    lastPaymentDate: lastPayment?.paidAt ?? lastPayment?.createdAt ?? null,
    receiptCount: receiptStats.issuedReceipts,
    welfareSupportCount: welfare.total,
  };
}
