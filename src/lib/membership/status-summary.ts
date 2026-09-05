import { listContributions } from "@/lib/contributions/repository";
import { formatContributionTypeLabel } from "@/lib/contributions/labels";
import {
  formatMonthlyDuesAlreadyPaidMessage,
} from "@/lib/payments/monthly-dues-guard";
import { getCurrentMonthYear } from "@/lib/finance/period";
import { listPayments } from "@/lib/payments/repository";
import { getReceiptStats } from "@/lib/receipts/repository";
import { listMemberWelfareHistory } from "@/lib/welfare/history";
import { assertOwnMemberScope } from "@/lib/members/member-context";
import { ContributionStatus, ContributionType } from "@/types/enums";
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

export interface GetMemberMembershipStatusOptions {
  /**
   * When provided (e.g. dashboard already loaded unified welfare history),
   * skips a second welfare-history fetch for the count only.
   */
  welfareSupportCount?: number;
}

export async function getMemberMembershipStatus(
  memberId: string,
  actor: CurrentUser,
  options: GetMemberMembershipStatusOptions = {},
): Promise<MemberMembershipStatus> {
  assertOwnMemberScope(memberId, actor);

  const includeWelfareFetch = options.welfareSupportCount === undefined;
  const { month: monthlyDuesMonth, year: monthlyDuesYear } = getCurrentMonthYear();

  // One member-scoped contributions read drives dues guard, last contribution,
  // and paid totals (replaces three independent contribution loaders).
  const [contributions, payments, receiptStats, welfareHistory] = await Promise.all([
    listContributions({ memberId, page: 1, pageSize: 1000 }),
    listPayments({ page: 1, pageSize: 1, memberId }, actor),
    getReceiptStats({ memberId }),
    includeWelfareFetch
      ? listMemberWelfareHistory(actor, { page: 1, pageSize: 1 })
      : Promise.resolve(null),
  ]);

  const paidContributions = contributions.records.filter(
    (record) => record.status === ContributionStatus.PAID,
  );
  const currentMonthDuesPaid = paidContributions.some(
    (record) =>
      record.contributionType === ContributionType.MONTHLY_DUES &&
      record.month === monthlyDuesMonth &&
      record.year === monthlyDuesYear,
  );

  const lastContribution = contributions.records[0] ?? null;
  const lastPayment = payments.records[0] ?? null;

  return {
    monthlyDuesPaid: currentMonthDuesPaid,
    monthlyDuesMessage: currentMonthDuesPaid
      ? formatMonthlyDuesAlreadyPaidMessage(monthlyDuesMonth, monthlyDuesYear)
      : null,
    monthlyDuesMonth,
    monthlyDuesYear,
    lastContributionDate: lastContribution?.createdAt ?? null,
    lastContributionAmount: lastContribution?.amount ?? null,
    lastContributionTypeLabel: lastContribution
      ? formatContributionTypeLabel(lastContribution.contributionType)
      : null,
    totalContributions: paidContributions.length,
    totalAmountPaid: paidContributions.reduce(
      (sum, record) => sum + record.amount,
      0,
    ),
    paymentCount: payments.total,
    lastPaymentDate: lastPayment?.paidAt ?? lastPayment?.createdAt ?? null,
    receiptCount: receiptStats.issuedReceipts,
    welfareSupportCount:
      options.welfareSupportCount ?? welfareHistory?.total ?? 0,
  };
}
