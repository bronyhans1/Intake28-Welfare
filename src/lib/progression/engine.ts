import { getCurrentMonthYear, toMonthKeyFromIsoDate } from "@/lib/finance/period";
import { getMemberById } from "@/lib/members/repository";
import { getSystemSettings } from "@/lib/system-settings/repository";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { MembershipProgressionStatus } from "@/types/enums";
import {
  calculateProgressionFromContributions,
  DEFAULT_LAPSED_THRESHOLD_MONTHS,
  type ProgressionContributionInput,
} from "@/lib/progression/calculator";
import {
  getProgressionByMemberId,
  syncMemberDefaulterFields,
  toProgressionSummary,
  upsertMembershipProgression,
} from "@/lib/progression/repository";
import type {
  MembershipProgressionSummary,
  SerializedMembershipProgression,
} from "@/types/membership-progression";

async function loadMemberContributionInputs(
  memberId: string,
): Promise<ProgressionContributionInput[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.CONTRIBUTIONS)
    .where("memberId", "==", memberId)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const createdAt = data.createdAt as { toDate?: () => Date } | undefined;
    const contributedAt =
      createdAt && typeof createdAt.toDate === "function"
        ? createdAt.toDate().toISOString()
        : null;

    return {
      year: Number(data.year),
      month: Number(data.month),
      contributionType: String(data.contributionType ?? ""),
      status: String(data.status ?? ""),
      contributedAt,
    };
  });
}

/**
 * Internal calculation implementation.
 * Kept as a local function so callers are not affected by circular-import
 * TDZ on live export bindings of `calculate`.
 */
async function runMembershipProgressionCalculation(
  memberId: string,
): Promise<SerializedMembershipProgression> {
  const member = await getMemberById(memberId);
  if (!member) {
    throw new Error("Member not found.");
  }

  const [contributions, settings, existing] = await Promise.all([
    loadMemberContributionInputs(memberId),
    getSystemSettings(),
    getProgressionByMemberId(memberId),
  ]);

  const asOf = getCurrentMonthYear();
  const membershipStart =
    toMonthKeyFromIsoDate(member.activatedAt) ??
    toMonthKeyFromIsoDate(member.createdAt) ??
    asOf;

  const result = calculateProgressionFromContributions({
    memberId,
    contributions,
    membershipStart,
    asOf,
    defaulterThresholdMonths: settings.defaulterThresholdMonths,
    lapsedThresholdMonths: DEFAULT_LAPSED_THRESHOLD_MONTHS,
    existingMaturityDate: existing?.maturityDate ?? null,
  });

  const saved = await upsertMembershipProgression(result);

  const isDefaulter =
    result.membershipStatus === MembershipProgressionStatus.DEFAULTING ||
    result.membershipStatus === MembershipProgressionStatus.LAPSED;

  try {
    await syncMemberDefaulterFields(memberId, {
      outstandingContributionMonths: result.outstandingContributionMonths,
      isDefaulter,
    });
  } catch (error) {
    console.error("[progression] Failed to sync member defaulter fields", {
      memberId,
      error,
    });
  }

  return saved;
}

/**
 * ProgressionEngine — single source of truth for membership progression.
 * Recalculates and persists welfare points, benefit %, maturity, eligibility, and status.
 */
export async function calculate(
  memberId: string,
): Promise<SerializedMembershipProgression> {
  return runMembershipProgressionCalculation(memberId);
}

export async function calculateSafe(memberId: string): Promise<void> {
  try {
    await runMembershipProgressionCalculation(memberId);
  } catch (error) {
    console.error("[progression] Failed to recalculate membership progression", {
      memberId,
      error,
    });
  }
}

export async function getProgressionSummary(
  memberId: string,
  options: { recalculate?: boolean } = {},
): Promise<MembershipProgressionSummary | null> {
  if (options.recalculate) {
    const record = await runMembershipProgressionCalculation(memberId);
    return toProgressionSummary(record);
  }

  const existing = await getProgressionByMemberId(memberId);
  if (existing) {
    return toProgressionSummary(existing);
  }

  const record = await runMembershipProgressionCalculation(memberId);
  return toProgressionSummary(record);
}

/**
 * Single application-wide entry point after contribution / membership events.
 * All manual, Paystack, and arrears flows must call this (or calculateSafe).
 */
export async function recalculateMembershipProgression(
  memberId: string,
): Promise<void> {
  if (!memberId?.trim()) return;
  await calculateSafe(memberId.trim());
}

export const ProgressionEngine = {
  calculate,
  calculateSafe,
  getProgressionSummary,
  recalculateMembershipProgression,
};

export {
  calculateBenefitPercentage,
  calculateProgressionFromContributions,
  MATURITY_SUCCESSFUL_MONTHS,
  FULL_BENEFIT_WELFARE_POINTS,
} from "@/lib/progression/calculator";
