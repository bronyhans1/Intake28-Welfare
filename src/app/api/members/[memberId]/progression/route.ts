import { NextResponse } from "next/server";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { getProgressionSummary } from "@/lib/progression";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ memberId: string }>;
}

function canView(
  actorUid: string,
  actorRole: Parameters<typeof hasPermission>[0],
  memberId: string,
): boolean {
  if (actorUid === memberId) return true;
  return hasPermission(actorRole, Permission.VIEW_MEMBERS);
}

/**
 * GET /api/members/[memberId]/progression
 * Returns welfare progression for a member.
 */
export async function GET(_request: Request, context: RouteContext) {
  const actor = await getCurrentUserFromSession();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { memberId } = await context.params;
  if (!memberId?.trim()) {
    return NextResponse.json({ error: "Member ID is required." }, { status: 400 });
  }

  if (!canView(actor.uid, actor.role, memberId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await getProgressionSummary(memberId);
    if (!data) {
      return NextResponse.json(
        { error: "Progression record not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        welfarePoints: data.welfarePoints,
        benefitPercentage: data.benefitPercentage,
        membershipStatus: data.membershipStatus,
        isMature: data.isMature,
        eligibleToClaim: data.eligibleToClaim,
        consecutiveContributionMonths: data.consecutiveContributionMonths,
        consecutiveMissedMonths: data.consecutiveMissedMonths,
        outstandingContributionMonths: data.outstandingContributionMonths ?? 0,
        outstandingMonths: data.outstandingMonths ?? [],
        successfulContributionMonths: data.successfulContributionMonths,
        maturityDate: data.maturityDate,
        lastSuccessfulContributionDate: data.lastSuccessfulContributionDate,
        lastCalculatedAt: data.lastCalculatedAt,
        memberId: data.memberId,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load membership progression.";
    const status = message === "Member not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
