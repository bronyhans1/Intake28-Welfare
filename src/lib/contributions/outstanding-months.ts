import {
  compareMonthYear,
  formatMonthYearLabel,
  getCurrentMonthYear,
  isSameMonthYear,
  toMonthKeyFromIsoDate,
  type MonthYear,
} from "@/lib/finance/period";
import { getContributionMonths } from "@/lib/contributions/repository";
import { findPaidMonthlyDuesContribution } from "@/lib/contributions/repository";
import { getMonthlyDuesAmount } from "@/lib/system-settings/repository";
import { getMemberById } from "@/lib/members/repository";

export interface OutstandingMonthItem {
  month: number;
  year: number;
  label: string;
  amount: number;
  isCurrent: boolean;
}

export interface MemberOutstandingContributions {
  membershipStart: MonthYear;
  currentMonth: MonthYear;
  monthlyDuesAmount: number;
  /** Unpaid months before the current month */
  arrears: OutstandingMonthItem[];
  /** Current month when still unpaid */
  current: OutstandingMonthItem | null;
  /** All unpaid months including current (arrears first, then current) */
  outstanding: OutstandingMonthItem[];
}

/**
 * Official contribution start month = calendar month of join
 * (activatedAt preferred, else createdAt) in Africa/Accra.
 */
export function resolveContributionStartMonth(member: {
  activatedAt?: string | null;
  createdAt?: string | null;
}): MonthYear | null {
  return (
    toMonthKeyFromIsoDate(member.activatedAt) ??
    toMonthKeyFromIsoDate(member.createdAt)
  );
}

export async function getMemberOutstandingContributions(
  memberId: string,
): Promise<MemberOutstandingContributions> {
  const member = await getMemberById(memberId);
  if (!member) {
    throw new Error("Member not found.");
  }

  const currentMonth = getCurrentMonthYear();
  const membershipStart =
    resolveContributionStartMonth(member) ?? currentMonth;

  // Never generate obligations before the join month.
  const rangeStart =
    compareMonthYear(membershipStart, currentMonth) > 0
      ? currentMonth
      : membershipStart;

  const monthlyDuesAmount = await getMonthlyDuesAmount();
  const candidateMonths = getContributionMonths(rangeStart, currentMonth);

  const outstanding: OutstandingMonthItem[] = [];
  for (const period of candidateMonths) {
    const paid = await findPaidMonthlyDuesContribution(
      memberId,
      period.month,
      period.year,
    );
    if (paid) continue;

    outstanding.push({
      month: period.month,
      year: period.year,
      label: formatMonthYearLabel(period),
      amount: monthlyDuesAmount,
      isCurrent: isSameMonthYear(period, currentMonth),
    });
  }

  const arrears = outstanding.filter((item) => !item.isCurrent);
  const current = outstanding.find((item) => item.isCurrent) ?? null;

  return {
    membershipStart,
    currentMonth,
    monthlyDuesAmount,
    arrears,
    current,
    outstanding,
  };
}

export function assertMonthsWithinContributionWindow(input: {
  selectedMonths: MonthYear[];
  membershipStart: MonthYear;
  currentMonth: MonthYear;
}): void {
  for (const period of input.selectedMonths) {
    if (period.month < 1 || period.month > 12 || !Number.isFinite(period.year)) {
      throw new Error("Invalid contribution month selected.");
    }
    if (compareMonthYear(period, input.membershipStart) < 0) {
      throw new Error(
        "You cannot pay for months before you joined the Welfare Scheme.",
      );
    }
    if (compareMonthYear(period, input.currentMonth) > 0) {
      throw new Error("You cannot pay for future contribution months.");
    }
  }
}
