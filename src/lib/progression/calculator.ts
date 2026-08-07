import { MembershipProgressionStatus } from "@/types/enums";
import type { ContributionStatus, ContributionType } from "@/types/enums";

/** Months of successful dues required for maturity */
export const MATURITY_SUCCESSFUL_MONTHS = 6;

/** Months of dues that yield 100% benefit */
export const FULL_BENEFIT_WELFARE_POINTS = 36;

/**
 * Constitutional lapse threshold — prolonged non-payment.
 * Defaulting uses system `defaulterThresholdMonths` (typically 2).
 */
export const DEFAULT_LAPSED_THRESHOLD_MONTHS = 6;

export interface ContributionMonthKey {
  year: number;
  month: number;
}

export interface ProgressionContributionInput {
  year: number;
  month: number;
  contributionType: ContributionType | string;
  status: ContributionStatus | string;
  /** ISO date or null — used for lastSuccessfulContributionDate / maturityDate */
  contributedAt?: string | null;
}

export interface ProgressionCalculationInput {
  memberId: string;
  /** Paid monthly-dues periods and related contribution rows */
  contributions: ProgressionContributionInput[];
  /** Membership start (activatedAt preferred, else createdAt) — used for outstanding obligations */
  membershipStart: ContributionMonthKey;
  /** Calculation as-of period (usually current Africa/Accra month) */
  asOf: ContributionMonthKey;
  /** From system settings — outstanding unpaid months → DEFAULTING */
  defaulterThresholdMonths: number;
  /** Prolonged unpaid → LAPSED */
  lapsedThresholdMonths?: number;
  /** Preserve existing maturity date when already mature */
  existingMaturityDate?: string | null;
}

export interface ProgressionCalculationResult {
  memberId: string;
  welfarePoints: number;
  benefitPercentage: number;
  successfulContributionMonths: number;
  consecutiveContributionMonths: number;
  /** Trailing unpaid streak from asOf (informational / streak displays). */
  consecutiveMissedMonths: number;
  /**
   * Unpaid monthly-dues months from join month through asOf.
   * First-class driver for DEFAULTING / LAPSED status.
   */
  outstandingContributionMonths: number;
  outstandingMonths: ContributionMonthKey[];
  isMature: boolean;
  eligibleToClaim: boolean;
  membershipStatus: MembershipProgressionStatus;
  maturityDate: string | null;
  lastSuccessfulContributionDate: string | null;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(key: string): ContributionMonthKey {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

export function compareMonthKeys(
  a: ContributionMonthKey,
  b: ContributionMonthKey,
): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function previousMonth(period: ContributionMonthKey): ContributionMonthKey {
  if (period.month <= 1) {
    return { year: period.year - 1, month: 12 };
  }
  return { year: period.year, month: period.month - 1 };
}

export function nextMonth(period: ContributionMonthKey): ContributionMonthKey {
  if (period.month >= 12) {
    return { year: period.year + 1, month: 1 };
  }
  return { year: period.year, month: period.month + 1 };
}

/**
 * Official benefit formula (approved Phase 3A revision):
 * - Points < 6 → 0%
 * - Points == 6 → 25%
 * - Points > 6 → floor(25 + (points - 6) * 2.5), capped at 100%
 * - At 36 points → 100%
 */
export function calculateBenefitPercentage(welfarePoints: number): number {
  const points = Math.max(0, Math.floor(welfarePoints));

  if (points < MATURITY_SUCCESSFUL_MONTHS) {
    return 0;
  }

  return Math.min(
    100,
    Math.floor(25 + (points - MATURITY_SUCCESSFUL_MONTHS) * 2.5),
  );
}

/**
 * Membership status from outstanding contribution months (join → asOf unpaid count).
 * NOT from trailing consecutive missed months.
 */
export function resolveMembershipProgressionStatus(input: {
  outstandingContributionMonths: number;
  defaulterThresholdMonths: number;
  lapsedThresholdMonths: number;
}): MembershipProgressionStatus {
  const outstanding = Math.max(0, input.outstandingContributionMonths);
  const defaulterThreshold = Math.max(1, input.defaulterThresholdMonths);
  const lapsedThreshold = Math.max(
    defaulterThreshold + 1,
    input.lapsedThresholdMonths,
  );

  if (outstanding >= lapsedThreshold) {
    return MembershipProgressionStatus.LAPSED;
  }
  if (outstanding >= defaulterThreshold) {
    return MembershipProgressionStatus.DEFAULTING;
  }
  return MembershipProgressionStatus.ACTIVE;
}

function isPaidMonthlyDues(row: ProgressionContributionInput): boolean {
  return (
    row.contributionType === "monthly_dues" && row.status === "paid"
  );
}

/**
 * Pure progression calculator — no I/O.
 * One welfare point per unique paid monthly-dues Contribution Month
 * (period fields year/month), regardless of registration or entry date.
 * DEFAULTING / LAPSED use outstandingContributionMonths (join → asOf).
 */
export function calculateProgressionFromContributions(
  input: ProgressionCalculationInput,
): ProgressionCalculationResult {
  const lapsedThreshold =
    input.lapsedThresholdMonths ?? DEFAULT_LAPSED_THRESHOLD_MONTHS;

  const paidByMonth = new Map<string, string | null>();
  for (const row of input.contributions) {
    if (!isPaidMonthlyDues(row)) continue;
    if (row.month < 1 || row.month > 12 || !Number.isFinite(row.year)) continue;
    const key = monthKey(row.year, row.month);
    const at = row.contributedAt ?? null;
    const existing = paidByMonth.get(key);
    if (!paidByMonth.has(key)) {
      paidByMonth.set(key, at);
    } else if (at && (!existing || at > existing)) {
      paidByMonth.set(key, at);
    }
  }

  // Unique successful Contribution Months: award points for each paid period
  // through asOf (including months before membership start / activation).
  // Do not award points for periods after asOf. Deduped by year-month key.
  const successfulKeys: string[] = [];
  for (const key of paidByMonth.keys()) {
    const period = parseMonthKey(key);
    if (compareMonthKeys(period, input.asOf) > 0) continue;
    successfulKeys.push(key);
  }
  successfulKeys.sort();

  const welfarePoints = successfulKeys.length;
  const successfulContributionMonths = welfarePoints;
  const benefitPercentage = calculateBenefitPercentage(welfarePoints);
  const isMature = successfulContributionMonths >= MATURITY_SUCCESSFUL_MONTHS;

  let lastSuccessfulContributionDate: string | null = null;
  let lastSuccessfulPeriod: ContributionMonthKey | null = null;
  for (const key of successfulKeys) {
    const at = paidByMonth.get(key) ?? null;
    const period = parseMonthKey(key);
    if (
      !lastSuccessfulPeriod ||
      compareMonthKeys(period, lastSuccessfulPeriod) > 0
    ) {
      lastSuccessfulPeriod = period;
    }
    if (at && (!lastSuccessfulContributionDate || at > lastSuccessfulContributionDate)) {
      lastSuccessfulContributionDate = at;
    }
  }

  // Outstanding months: every unpaid month from join through asOf
  const outstandingMonths: ContributionMonthKey[] = [];
  let outstandingCursor = input.membershipStart;
  while (compareMonthKeys(outstandingCursor, input.asOf) <= 0) {
    const key = monthKey(outstandingCursor.year, outstandingCursor.month);
    if (!paidByMonth.has(key)) {
      outstandingMonths.push({
        year: outstandingCursor.year,
        month: outstandingCursor.month,
      });
    }
    outstandingCursor = nextMonth(outstandingCursor);
  }
  const outstandingContributionMonths = outstandingMonths.length;

  // Trailing missed: walk backward from asOf while unpaid (streak display only)
  let consecutiveMissedMonths = 0;
  let cursor = input.asOf;
  while (compareMonthKeys(cursor, input.membershipStart) >= 0) {
    const key = monthKey(cursor.year, cursor.month);
    if (paidByMonth.has(key)) break;
    consecutiveMissedMonths += 1;
    cursor = previousMonth(cursor);
  }

  // Consecutive contributions: streak ending at latest paid month <= asOf
  let consecutiveContributionMonths = 0;
  let streakCursor =
    lastSuccessfulPeriod && compareMonthKeys(lastSuccessfulPeriod, input.asOf) <= 0
      ? lastSuccessfulPeriod
      : null;

  if (streakCursor) {
    while (compareMonthKeys(streakCursor, input.membershipStart) >= 0) {
      const key = monthKey(streakCursor.year, streakCursor.month);
      if (!paidByMonth.has(key)) break;
      consecutiveContributionMonths += 1;
      streakCursor = previousMonth(streakCursor);
    }
  }

  const membershipStatus = resolveMembershipProgressionStatus({
    outstandingContributionMonths,
    defaulterThresholdMonths: input.defaulterThresholdMonths,
    lapsedThresholdMonths: lapsedThreshold,
  });

  const eligibleToClaim =
    isMature && membershipStatus === MembershipProgressionStatus.ACTIVE;

  let maturityDate: string | null = null;
  if (isMature) {
    maturityDate = input.existingMaturityDate ?? null;
    if (!maturityDate) {
      const sixthKey = successfulKeys[MATURITY_SUCCESSFUL_MONTHS - 1];
      maturityDate =
        (sixthKey ? paidByMonth.get(sixthKey) : null) ??
        lastSuccessfulContributionDate;
    }
  }

  return {
    memberId: input.memberId,
    welfarePoints,
    benefitPercentage,
    successfulContributionMonths,
    consecutiveContributionMonths,
    consecutiveMissedMonths,
    outstandingContributionMonths,
    outstandingMonths,
    isMature,
    eligibleToClaim,
    membershipStatus,
    maturityDate,
    lastSuccessfulContributionDate,
  };
}
