import { redirect } from "next/navigation";
import { MemberDashboard } from "@/components/member/member-dashboard";
import { MemberPageShell } from "@/components/member/member-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { requireOwnMemberPortalAccess } from "@/lib/auth/require-member-portal";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { getMemberById } from "@/lib/members/repository";
import { listVisibleAnnouncementsForUser } from "@/lib/announcements/repository";
import { getMemberMembershipStatus } from "@/lib/membership/status-summary";
import { listMemberWelfareHistory } from "@/lib/welfare/history";
import { listAllWelfareSupportTypeOptions } from "@/lib/welfare-support-types/repository";
import {
  calculateProfileCompletion,
  toProfileCompletionContext,
} from "@/lib/utils/profile-completion";
import { getWelfareJourneyDashboard } from "@/lib/welfare-journey/service";
import { getActiveConstitution } from "@/lib/claims/constitution-repository";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "My Welfare Journey",
  "Your GIS Intake 28 welfare member dashboard and My Welfare Journey.",
);

export default async function DashboardPage() {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    redirect("/login");
  }

  await requireOwnMemberPortalAccess(actor, "/dashboard");

  if (!isFirebaseAdminConfigured()) {
    return (
      <MemberPageShell title="Dashboard" description="Member dashboard overview.">
        <p className="text-sm text-muted-foreground">
          Member services are temporarily unavailable. Please try again later.
        </p>
      </MemberPageShell>
    );
  }

  // Load welfare history first so membership status can reuse its total
  // instead of issuing a second unified welfare history fetch.
  const [member, welfareData, visibleAnnouncements, officialConstitution, supportTypes] =
    await Promise.all([
      getMemberById(actor.uid),
      listMemberWelfareHistory(actor, { page: 1, pageSize: 5 }),
      listVisibleAnnouncementsForUser(actor),
      getActiveConstitution(),
      listAllWelfareSupportTypeOptions(),
    ]);

  if (!member) {
    redirect("/login");
  }

  const [membershipStatus, welfareJourney] = await Promise.all([
    getMemberMembershipStatus(actor.uid, actor, {
      welfareSupportCount: welfareData.total,
    }),
    getWelfareJourneyDashboard(member).catch(() => null),
  ]);

  // Derive contribution summary from membership status (same paid totals /
  // last date) — avoids a second and third contributions collection read.
  const contributionStats = {
    totalContributions: membershipStatus.totalContributions,
    totalAmountCollected: membershipStatus.totalAmountPaid,
    membersContributed: membershipStatus.totalContributions > 0 ? 1 : 0,
  };
  const lastContributionDate = membershipStatus.lastContributionDate;

  const latestAnnouncement = visibleAnnouncements[0] ?? null;
  const visibleAnnouncementCount = visibleAnnouncements.length;
  const supportTypeLabelMap = Object.fromEntries(
    supportTypes.map((type) => [type.code, type.displayName]),
  );

  const completion = calculateProfileCompletion(toProfileCompletionContext(member));

  return (
    <MemberPageShell>
      <MemberDashboard
        member={member}
        completion={completion}
        welfareRecords={welfareData.entries}
        supportTypeLabelMap={supportTypeLabelMap}
        latestAnnouncement={latestAnnouncement}
        visibleAnnouncementCount={visibleAnnouncementCount}
        contributionStats={contributionStats}
        lastContributionDate={lastContributionDate}
        membershipStatus={membershipStatus}
        welfareJourney={welfareJourney}
        officialConstitution={officialConstitution}
      />
    </MemberPageShell>
  );
}
