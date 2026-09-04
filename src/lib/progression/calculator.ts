import { MembershipProgressionStatus } from "@/types/enums";
import type { ContributionStatus, ContributionType } from "@/types/enums";

/** Months of successful dues required for maturity (current progression epoch). */
export const MATURITY_SUCCESSFUL_MONTHS = 6;

/** Months of dues that yield 100% benefit. */
export const FULL_BENEFIT_WELFARE_POINTS = 36;

/** Pre-maturity: consecutive completed unpaid months → progression reset. */
export const PRE_MATURITY_RESET_STREAK_MONTHS = 2;

/** Post-maturity: consecutive completed unpaid months → progression reset. */
export const POST_MATURITY_RESET_STREAK_MONTHS = 6;

/** @deprecated Use POST_MATURITY_RESET_STREAK_MONTHS — kept for import compatibility. */
export const DEFAULT_LAPSED_THRESHOLD_MONTHS = POST_MATURITY_RESET_STREAK_MONTHS;

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
  /** Membership start (createdAt month, Africa/Accra) — obligations + grace */
  membershipStart: ContributionMonthKey;
  /** Calculation as-of period (usually current Africa/Accra month) */
  asOf: ContributionMonthKey;
  /**
   * Pre-maturity consecutive completed-miss threshold (system settings; default 2).
   * Kept for configurability; business default is PRE_MATURITY_RESET_STREAK_MONTHS.
   */
  defaulterThresholdMonths: number;
  /** Post-maturity reset streak (default POST_MATURITY_RESET_STREAK_MONTHS). */
  postMaturityResetMonths?: number;
  /** @deprecated Ignored — LAPSED is no longer the reset mechanism. */
  lapsedThresholdMonths?: number;
  /** Preserve existing maturity date when already mature (same epoch). */
  existingMaturityDate?: string | null;
  /** Current progression epoch start month (null = membership start). */
  existingProgressionEpoch?: ContributionMonthKey | null;
  existingResetCount?: number;
  existingLastProgressionResetAt?: string | null;
  /** ISO timestamp used when a reset is applied (tests can inject). */
  resetAtIso?: string | null;
}

export interface ProgressionCalculationResult {
  memberId: string;
  welfarePoints: number;
  benefitPercentage: number;
  successfulContributionMonths: number;
  consecutiveContributionMonths: number;
  /**
   * Consecutive completed unpaid months counting toward reset
   * (excludes joining-month grace and the open asOf month).
   */
  consecutiveMissedMonths: number;
  /**
   * Unpaid monthly-dues months from join month through asOf (payable / arrears).
   * Not the reset trigger.
   */
  outstandingContributionMonths: number;
  outstandingMonths: ContributionMonthKey[];
  isMature: boolean;
  eligibleToClaim: boolean;
  membershipStatus: MembershipProgressionStatus;
  maturityDate: string | null;
  lastSuccessfulContributionDate: string | null;
  progressionEpochMonth: ContributionMonthKey;
  lastProgressionResetAt: string | null;
  resetCount: number;
  /** True only when a meaningful progression wipe occurred this calculation. */
  didReset: boolean;
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
 * Membership status from consecutive completed missed months (reset clock).
 * LAPSED is no longer emitted as a reset mechanism.
 */
export function resolveMembershipProgressionStatus(input: {
  consecutiveMissedMonths: number;
}): MembershipProgressionStatus {
  if (input.consecutiveMissedMonths >= 1) {
    return MembershipProgressionStatus.DEFAULTING;
  }
  return MembershipProgressionStatus.ACTIVE;
}

function isPaidMonthlyDues(row: ProgressionContributionInput): boolean {
  return (
    row.contributionType === "monthly_dues" && row.status === "paid"
  );
}

function resolveEpochStart(
  membershipStart: ContributionMonthKey,
  existing: ContributionMonthKey | null | undefined,
): ContributionMonthKey {
  if (!existing) return { ...membershipStart };
  // Epoch cannot start before membership.
  if (compareMonthKeys(existing, membershipStart) < 0) {
    return { ...membershipStart };
  }
  return { ...existing };
}

/**
 * Consecutive completed unpaid months for reset/defaulting.
 * - Excludes the open `asOf` month.
 * - Joining month is grace: never increments the streak; walking stops there.
 * - When `epochStart` is set, months before the epoch do not count (already
 *   consumed by a prior reset / outside the current progression epoch).
 */
export function countConsecutiveCompletedMissedMonths(input: {
  membershipStart: ContributionMonthKey;
  asOf: ContributionMonthKey;
  paidByMonth: ReadonlySet<string> | ReadonlyMap<string, unknown>;
  /** If set, stop before this month (exclusive lower bound for counting). */
  epochStart?: ContributionMonthKey | null;
}): number {
  const lastCompleted = previousMonth(input.asOf);
  if (compareMonthKeys(lastCompleted, input.membershipStart) < 0) {
    return 0;
  }

  const floor =
    input.epochStart &&
    compareMonthKeys(input.epochStart, input.membershipStart) > 0
      ? input.epochStart
      : null;

  let consecutiveMissedMonths = 0;
  let cursor = lastCompleted;

  while (compareMonthKeys(cursor, input.membershipStart) >= 0) {
    if (floor && compareMonthKeys(cursor, floor) < 0) {
      break;
    }

    if (compareMonthKeys(cursor, input.membershipStart) === 0) {
      // Joining-month grace — do not count; do not look earlier.
      break;
    }

    const key = monthKey(cursor.year, cursor.month);
    if (input.paidByMonth.has(key)) {
      break;
    }

    consecutiveMissedMonths += 1;
    cursor = previousMonth(cursor);
  }

  return consecutiveMissedMonths;
}

function collectSuccessfulKeysInEpoch(input: {
  paidByMonth: Map<string, string | null>;
  epochStart: ContributionMonthKey;
  asOf: ContributionMonthKey;
  membershipStart: ContributionMonthKey;
}): string[] {
  const epochIsInitial =
    compareMonthKeys(input.epochStart, input.membershipStart) === 0;
  const successfulKeys: string[] = [];
  for (const key of input.paidByMonth.keys()) {
    const period = parseMonthKey(key);
    if (compareMonthKeys(period, input.asOf) > 0) continue;
    if (compareMonthKeys(period, input.epochStart) >= 0) {
      successfulKeys.push(key);
      continue;
    }
    // Initial epoch only: allow backdated paid months before join.
    if (
      epochIsInitial &&
      compareMonthKeys(period, input.membershipStart) < 0
    ) {
      successfulKeys.push(key);
    }
  }
  successfulKeys.sort();
  return successfulKeys;
}

function buildPointsSnapshot(input: {
  paidByMonth: Map<string, string | null>;
  epochStart: ContributionMonthKey;
  asOf: ContributionMonthKey;
  membershipStart: ContributionMonthKey;
  existingMaturityDate?: string | null;
}): {
  welfarePoints: number;
  successfulContributionMonths: number;
  benefitPercentage: number;
  isMature: boolean;
  successfulKeys: string[];
  lastSuccessfulContributionDate: string | null;
  lastSuccessfulPeriod: ContributionMonthKey | null;
  consecutiveContributionMonths: number;
  maturityDate: string | null;
} {
  const successfulKeys = collectSuccessfulKeysInEpoch({
    paidByMonth: input.paidByMonth,
    epochStart: input.epochStart,
    asOf: input.asOf,
    membershipStart: input.membershipStart,
  });
  const welfarePoints = successfulKeys.length;
  const successfulContributionMonths = welfarePoints;
  const benefitPercentage = calculateBenefitPercentage(welfarePoints);
  const isMature = successfulContributionMonths >= MATURITY_SUCCESSFUL_MONTHS;

  let lastSuccessfulContributionDate: string | null = null;
  let lastSuccessfulPeriod: ContributionMonthKey | null = null;
  for (const key of successfulKeys) {
    const at = input.paidByMonth.get(key) ?? null;
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

  let consecutiveContributionMonths = 0;
  let streakCursor =
    lastSuccessfulPeriod && compareMonthKeys(lastSuccessfulPeriod, input.asOf) <= 0
      ? lastSuccessfulPeriod
      : null;

  if (streakCursor) {
    while (compareMonthKeys(streakCursor, input.epochStart) >= 0) {
      const key = monthKey(streakCursor.year, streakCursor.month);
      if (!input.paidByMonth.has(key)) break;
      consecutiveContributionMonths += 1;
      streakCursor = previousMonth(streakCursor);
    }
  }

  let maturityDate: string | null = null;
  if (isMature) {
    maturityDate = input.existingMaturityDate ?? null;
    if (!maturityDate) {
      const sixthKey = successfulKeys[MATURITY_SUCCESSFUL_MONTHS - 1];
      maturityDate =
        (sixthKey ? input.paidByMonth.get(sixthKey) : null) ??
        lastSuccessfulContributionDate;
    }
  }

  return {
    welfarePoints,
    successfulContributionMonths,
    benefitPercentage,
    isMature,
    successfulKeys,
    lastSuccessfulContributionDate,
    lastSuccessfulPeriod,
    consecutiveContributionMonths,
    maturityDate,
  };
}

/**
 * Pure progression calculator — no I/O.
 *
 * Points / maturity are scoped to the current progression epoch.
 * Outstanding obligations still span join → asOf (payable list).
 * Reset uses consecutive completed unpaid months (grace + open-month rules).
 */
export function calculateProgressionFromContributions(
  input: ProgressionCalculationInput,
): ProgressionCalculationResult {
  const preMaturityThreshold = Math.max(
    1,
    input.defaulterThresholdMonths || PRE_MATURITY_RESET_STREAK_MONTHS,
  );
  const postMaturityThreshold = Math.max(
    preMaturityThreshold + 1,
    input.postMaturityResetMonths ?? POST_MATURITY_RESET_STREAK_MONTHS,
  );

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

  let epochStart = resolveEpochStart(
    input.membershipStart,
    input.existingProgressionEpoch,
  );
  let resetCount = Math.max(0, input.existingResetCount ?? 0);
  let lastProgressionResetAt = input.existingLastProgressionResetAt ?? null;
  let didReset = false;

  // Outstanding months: every unpaid month from join through asOf (payable).
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

  const consecutiveMissedMonths = countConsecutiveCompletedMissedMonths({
    membershipStart: input.membershipStart,
    asOf: input.asOf,
    paidByMonth,
  });

  // Reset trigger ignores months before the current epoch (idempotent after reset).
  const resetTriggerStreak = countConsecutiveCompletedMissedMonths({
    membershipStart: input.membershipStart,
    asOf: input.asOf,
    paidByMonth,
    epochStart,
  });

  let snapshot = buildPointsSnapshot({
    paidByMonth,
    epochStart,
    asOf: input.asOf,
    membershipStart: input.membershipStart,
    existingMaturityDate: input.existingMaturityDate,
  });

  const resetThreshold = snapshot.isMature
    ? postMaturityThreshold
    : preMaturityThreshold;

  const hasAccumulatedProgression =
    snapshot.welfarePoints > 0 ||
    snapshot.successfulContributionMonths > 0 ||
    snapshot.isMature;

  if (resetTriggerStreak >= resetThreshold && hasAccumulatedProgression) {
    // New epoch starts at asOf — historical pays before asOf no longer count.
    epochStart = { ...input.asOf };
    resetCount += 1;
    lastProgressionResetAt =
      input.resetAtIso ??
      lastProgressionResetAt ??
      new Date().toISOString();
    didReset = true;

    snapshot = buildPointsSnapshot({
      paidByMonth,
      epochStart,
      asOf: input.asOf,
      membershipStart: input.membershipStart,
      existingMaturityDate: null,
    });
  }

  const membershipStatus = resolveMembershipProgressionStatus({
    consecutiveMissedMonths,
  });

  const eligibleToClaim =
    snapshot.isMature && membershipStatus === MembershipProgressionStatus.ACTIVE;

  return {
    memberId: input.memberId,
    welfarePoints: snapshot.welfarePoints,
    benefitPercentage: snapshot.benefitPercentage,
    successfulContributionMonths: snapshot.successfulContributionMonths,
    consecutiveContributionMonths: snapshot.consecutiveContributionMonths,
    consecutiveMissedMonths,
    outstandingContributionMonths,
    outstandingMonths,
    isMature: snapshot.isMature,
    eligibleToClaim,
    membershipStatus,
    maturityDate: snapshot.maturityDate,
    lastSuccessfulContributionDate: snapshot.lastSuccessfulContributionDate,
    progressionEpochMonth: epochStart,
    lastProgressionResetAt,
    resetCount,
    didReset,
  };
}
