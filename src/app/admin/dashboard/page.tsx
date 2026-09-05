import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AdminDashboardOverview } from "@/components/admin/admin-dashboard-overview";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  getAdminMemberOverview,
  getRecentActivity,
} from "@/lib/dashboard/admin-dashboard.service";
import { getExecutiveProgressionInsights } from "@/lib/dashboard/executive-progression-insights";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { canManageMembers, canViewMembers } from "@/lib/members/repository";
import { getPublishedAnnouncementsOverview } from "@/lib/announcements/repository";
import { getRecentUnreadNotifications } from "@/lib/notifications/repository";
import { getMemberMembershipStatus } from "@/lib/membership/status-summary";
import { resolveOwnMemberId } from "@/lib/members/member-context";
import { getUnifiedWelfarePaidStats } from "@/lib/welfare/history";
import { getExecutiveDashboardTitle } from "@/lib/utils/dashboard-title";
import { getFirstName } from "@/lib/utils/greeting";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const actor = await getCurrentUserFromSession();
  const title = actor ? getExecutiveDashboardTitle(actor.role) : "Dashboard";

  return createPageMetadata(
    title,
    "Administrative overview — members, collections, defaulters, and reports.",
  );
}

export default async function AdminDashboardPage() {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewMembers(actor.role)) {
    redirect("/dashboard");
  }

  const dashboardTitle = getExecutiveDashboardTitle(actor.role);

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell
        title={dashboardTitle}
        description="Administrative overview for GIS Intake 28 welfare operations."
      >
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured. Please check server environment variables.
        </p>
      </AdminPageShell>
    );
  }

  const ownMemberId = await resolveOwnMemberId(actor);

  // Member overview (one users read) first so progression insights can reuse names.
  const memberOverview = await getAdminMemberOverview(10);
  const knownActorNames = new Map(
    [...memberOverview.memberNames.entries()].map(([id, identity]) => [
      id,
      identity.fullName,
    ]),
  );

  const [
    welfareStats,
    announcementOverview,
    recentNotifications,
    recentActivity,
    membershipStatus,
    progressionInsights,
  ] = await Promise.all([
    getUnifiedWelfarePaidStats(),
    getPublishedAnnouncementsOverview(5),
    getRecentUnreadNotifications(actor, 5),
    getRecentActivity(10, {
      sessionUserFullName: actor.fullName,
      knownActorNames,
    }),
    ownMemberId
      ? getMemberMembershipStatus(ownMemberId, actor)
      : Promise.resolve(null),
    getExecutiveProgressionInsights({
      memberNames: memberOverview.memberNames,
    }).catch(() => null),
  ]);

  return (
    <AdminPageShell
      greetingFirstName={getFirstName(actor.fullName)}
      title={dashboardTitle}
      description="Here's the latest welfare portal activity."
    >
      <AdminDashboardOverview
        stats={memberOverview.stats}
        welfareStats={welfareStats}
        publishedAnnouncementCount={announcementOverview.count}
        recentAnnouncements={announcementOverview.recent}
        recentNotifications={recentNotifications}
        recentMembers={memberOverview.recentMembers}
        recentActivity={recentActivity}
        membershipStatus={membershipStatus}
        canManage={canManageMembers(actor.role)}
        progressionInsights={progressionInsights}
      />
    </AdminPageShell>
  );
}
