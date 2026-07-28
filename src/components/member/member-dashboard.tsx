import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AnnouncementsSummaryCard, LatestAnnouncementCard } from "@/components/member/member-announcements";
import { MemberContributionsDashboardCard } from "@/components/member/member-contributions";
import { MemberMembershipStatusCard } from "@/components/member/member-membership-status";
import { MemberOfficialConstitutionCard } from "@/components/member/member-official-constitution-card";
import { RecentWelfareSupport } from "@/components/member/member-welfare-support";
import { MyWelfareJourney } from "@/components/member/welfare-journey/my-welfare-journey";
import type { ProfileCompletionResult } from "@/lib/utils/profile-completion";
import { formatGenderLabel } from "@/lib/utils/gender";
import type { ContributionStats } from "@/lib/contributions/repository";
import type { MemberMembershipStatus } from "@/lib/membership/status-summary";
import type { SerializedMember } from "@/types/user";
import type { SerializedAnnouncement } from "@/types/announcement";
import type { SerializedWelfareSupport } from "@/types/welfare-support";
import type { WelfareJourneyDashboard } from "@/types/welfare-journey";
import type { SerializedConstitutionVersion } from "@/types/claims";
import { ProfileCompletionCard } from "@/components/member/profile-completion-card";

interface MemberDashboardProps {
  member: SerializedMember;
  completion: ProfileCompletionResult;
  welfareRecords: SerializedWelfareSupport[];
  latestAnnouncement: SerializedAnnouncement | null;
  visibleAnnouncementCount: number;
  contributionStats: ContributionStats;
  lastContributionDate: string | null;
  membershipStatus: MemberMembershipStatus;
  welfareJourney: WelfareJourneyDashboard | null;
  officialConstitution: SerializedConstitutionVersion | null;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

export function MemberDashboard({
  member,
  completion,
  welfareRecords,
  latestAnnouncement,
  visibleAnnouncementCount,
  contributionStats,
  lastContributionDate,
  membershipStatus,
  welfareJourney,
  officialConstitution,
}: MemberDashboardProps) {
  return (
    <div className="space-y-10">
      {welfareJourney ? (
        <MyWelfareJourney journey={welfareJourney} />
      ) : (
        <p className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          Your Welfare Journey could not be loaded right now. Other dashboard
          information is still available below.
        </p>
      )}

      <MemberOfficialConstitutionCard constitution={officialConstitution} />

      <section aria-labelledby="member-overview-heading" className="space-y-4">
        <h2
          id="member-overview-heading"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Member Overview
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <MemberMembershipStatusCard status={membershipStatus} />

          <ProfileCompletionCard completion={completion} />

          <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Member Summary</CardTitle>
              <CardDescription>
                Your current welfare portal profile.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <SummaryItem label="Service Number" value={member.serviceNumber} />
                <SummaryItem label="Full Name" value={member.fullName} />
                <SummaryItem
                  label="Gender"
                  value={formatGenderLabel(member.gender)}
                />
                <SummaryItem label="Rank" value={member.rank || "—"} />
                <SummaryItem label="Station" value={member.station || "—"} />
              </dl>
            </CardContent>
          </Card>

          <AnnouncementsSummaryCard count={visibleAnnouncementCount} />

          <LatestAnnouncementCard announcement={latestAnnouncement} />

          <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Recent Welfare Support</CardTitle>
              <CardDescription>
                Latest welfare assistance granted to you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentWelfareSupport records={welfareRecords} />
            </CardContent>
          </Card>

          <MemberContributionsDashboardCard
            stats={contributionStats}
            lastContributionDate={lastContributionDate}
          />
        </div>
      </section>
    </div>
  );
}
