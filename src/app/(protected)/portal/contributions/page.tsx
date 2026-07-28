import { redirect } from "next/navigation";
import {
  MemberContributionsSummary,
  MemberContributionsTable,
} from "@/components/member/member-contributions";
import { MemberOutstandingContributionsPayment } from "@/components/member/member-outstanding-contributions-payment";
import { MemberPageShell } from "@/components/member/member-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  getContributionStats,
  listContributions,
} from "@/lib/contributions/repository";
import { getMemberOutstandingContributions } from "@/lib/contributions/outstanding-months";
import { getCurrentMonthYear } from "@/lib/finance/period";
import { getProgressionByMemberId } from "@/lib/progression/repository";
import { getSystemSettings } from "@/lib/system-settings/repository";
import { ContributionStatus, MembershipProgressionStatus } from "@/types/enums";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "My Contributions",
  "View your welfare scheme contribution history",
);

export default async function MemberContributionsPage() {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    redirect("/login");
  }

  if (!hasPermission(actor.role, Permission.VIEW_CONTRIBUTIONS)) {
    redirect("/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <MemberPageShell title="My Contributions" description="Contributions are unavailable.">
        <p className="text-sm text-muted-foreground">
          Services are temporarily unavailable. Please try again later.
        </p>
      </MemberPageShell>
    );
  }

  const [stats, data, outstanding, progression, settings] = await Promise.all([
    getContributionStats({ memberId: actor.uid }),
    listContributions({
      memberId: actor.uid,
      page: 1,
      pageSize: 100,
    }),
    getMemberOutstandingContributions(actor.uid),
    getProgressionByMemberId(actor.uid),
    getSystemSettings(),
  ]);

  const lastContributionDate = data.records[0]?.createdAt ?? null;
  const asOf = getCurrentMonthYear();

  return (
    <MemberPageShell
      title="My Contributions"
      description="Your monthly dues and other welfare scheme contributions."
    >
      {hasPermission(actor.role, Permission.MAKE_PAYMENTS) ? (
        <MemberOutstandingContributionsPayment
          memberId={actor.uid}
          monthlyDuesAmount={outstanding.monthlyDuesAmount}
          arrears={outstanding.arrears}
          current={outstanding.current}
          progression={{
            membershipStart: outstanding.membershipStart,
            asOf,
            contributions: data.records.map((record) => ({
              year: record.year,
              month: record.month,
              contributionType: record.contributionType,
              status: record.status ?? ContributionStatus.PAID,
              contributedAt: record.createdAt,
            })),
            defaulterThresholdMonths: settings.defaulterThresholdMonths,
            welfarePoints: progression?.welfarePoints ?? 0,
            benefitPercentage: progression?.benefitPercentage ?? 0,
            membershipStatus:
              progression?.membershipStatus ??
              MembershipProgressionStatus.ACTIVE,
          }}
        />
      ) : null}
      <MemberContributionsSummary stats={stats} lastContributionDate={lastContributionDate} />
      <MemberContributionsTable records={data.records} />
    </MemberPageShell>
  );
}
