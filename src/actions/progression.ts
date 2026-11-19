"use server";

import { getCurrentUserFromSession } from "@/lib/auth/session";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  ProgressionEngine,
  getProgressionSummary,
} from "@/lib/progression";
import type { MembershipProgressionSummary } from "@/types/membership-progression";

export type ProgressionActionState = {
  error?: string;
  success?: boolean;
  data?: MembershipProgressionSummary;
};

function canViewMemberProgression(
  actorUid: string,
  actorRole: Parameters<typeof hasPermission>[0],
  memberId: string,
): boolean {
  if (actorUid === memberId) return true;
  return hasPermission(actorRole, Permission.VIEW_MEMBERS);
}

export async function fetchMemberProgressionAction(
  memberId: string,
  options: { recalculate?: boolean } = {},
): Promise<ProgressionActionState> {
  const actor = await getCurrentUserFromSession();
  if (!actor) {
    return { error: "Unauthorized" };
  }

  if (!canViewMemberProgression(actor.uid, actor.role, memberId)) {
    return { error: "You do not have permission to view this progression." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: "Progression service is temporarily unavailable." };
  }

  try {
    const data = await getProgressionSummary(memberId, {
      recalculate: options.recalculate,
    });
    if (!data) {
      return { error: "Progression record not found." };
    }
    return { success: true, data };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to load membership progression.",
    };
  }
}

export async function recalculateMemberProgressionAction(
  memberId: string,
): Promise<ProgressionActionState> {
  const actor = await getCurrentUserFromSession();
  if (!actor) {
    return { error: "Unauthorized" };
  }

  if (!hasPermission(actor.role, Permission.VIEW_MEMBERS)) {
    return { error: "You do not have permission to recalculate progression." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: "Progression service is temporarily unavailable." };
  }

  try {
    const record = await ProgressionEngine.calculate(memberId);
    return {
      success: true,
      data: {
        memberId: record.memberId,
        welfarePoints: record.welfarePoints,
        benefitPercentage: record.benefitPercentage,
        membershipStatus: record.membershipStatus,
        isMature: record.isMature,
        eligibleToClaim: record.eligibleToClaim,
        successfulContributionMonths: record.successfulContributionMonths,
        consecutiveContributionMonths: record.consecutiveContributionMonths,
        consecutiveMissedMonths: record.consecutiveMissedMonths,
        outstandingContributionMonths:
          record.outstandingContributionMonths ?? 0,
        outstandingMonths: record.outstandingMonths ?? [],
        maturityDate: record.maturityDate,
        lastSuccessfulContributionDate: record.lastSuccessfulContributionDate,
        lastCalculatedAt: record.lastCalculatedAt,
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to recalculate membership progression.",
    };
  }
}
