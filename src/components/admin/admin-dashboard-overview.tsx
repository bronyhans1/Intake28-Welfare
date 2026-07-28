"use client";

import {
  Activity,
  ArrowRight,
  Clock,
  HandHeart,
  Megaphone,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActivationBadge, RoleBadge, StatusBadge } from "@/components/admin/member-badges";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RecentAnnouncements } from "@/components/member/member-announcements";
import { MemberMembershipStatusCard } from "@/components/member/member-membership-status";
import { MemberServicesCard } from "@/components/member/member-services-card";
import type {
  MemberStats,
  RecentActivityItem,
  RecentMemberSummary,
} from "@/lib/dashboard/admin-dashboard.service";
import type { MemberMembershipStatus } from "@/lib/membership/status-summary";
import { RecentNotifications } from "@/components/admin/recent-notifications";
import { ExecutiveProgressionInsightsPanel } from "@/components/admin/executive-progression-insights-panel";
import type { SerializedNotificationEvent } from "@/lib/notifications/types";
import type { SerializedAnnouncement } from "@/types/announcement";
import type { WelfareSupportStats } from "@/lib/welfare/repository";
import type { ExecutiveProgressionInsights } from "@/lib/dashboard/executive-progression-insights";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { ActivationStatus, UserRole, UserStatus } from "@/types/enums";
import { cn } from "@/lib/utils";

interface AdminDashboardOverviewProps {
  stats: MemberStats;
  welfareStats: WelfareSupportStats;
  publishedAnnouncementCount: number;
  recentAnnouncements: SerializedAnnouncement[];
  recentNotifications: SerializedNotificationEvent[];
  recentMembers: RecentMemberSummary[];
  recentActivity: RecentActivityItem[];
  membershipStatus: MemberMembershipStatus;
  canManage: boolean;
  progressionInsights: ExecutiveProgressionInsights | null;
}

interface KpiCardProps {
  title: string;
  value: number | string;
  description: string;
  icon: React.ReactNode;
  accentClassName: string;
  href: string;
  onNavigate: (href: string) => void;
}

function KpiCard({
  title,
  value,
  description,
  icon,
  accentClassName,
  href,
  onNavigate,
}: KpiCardProps) {
  function handleActivate() {
    onNavigate(href);
  }

  return (
    <Card
      className={cn(
        "cursor-pointer rounded-2xl border border-black/[0.08] bg-white shadow-sm transition-all",
        "hover:border-black/[0.14] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534]/30",
      )}
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleActivate();
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={`${title}: ${value}. ${description}`}
    >
      <CardContent className="flex items-start justify-between gap-4 pt-6">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            accentClassName,
          )}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionLink({
  href,
  label,
  description,
  disabled = false,
}: {
  href?: string;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  const className = cn(
    buttonVariants({ variant: "outline" }),
    "h-auto w-full justify-between rounded-xl px-4 py-3 text-left",
    disabled && "pointer-events-none opacity-60",
  );

  const content = (
    <>
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </>
  );

  if (disabled || !href) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

function activityDetail(item: RecentActivityItem): string {
  const serviceNumber =
    typeof item.metadata?.serviceNumber === "string"
      ? item.metadata.serviceNumber
      : null;
  const fullName =
    typeof item.metadata?.fullName === "string" ? item.metadata.fullName : null;

  if (fullName && serviceNumber) {
    return `${fullName} (${serviceNumber})`;
  }

  if (serviceNumber) {
    return serviceNumber;
  }

  return item.entityId;
}

export function AdminDashboardOverview({
  stats,
  welfareStats,
  publishedAnnouncementCount,
  recentAnnouncements,
  recentNotifications,
  recentMembers,
  recentActivity,
  membershipStatus,
  canManage,
  progressionInsights,
}: AdminDashboardOverviewProps) {
  const router = useRouter();

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Members"
          value={stats.totalMembers}
          description="All registered welfare members"
          icon={<Users className="size-5 text-emerald-700" />}
          accentClassName="bg-emerald-50"
          href="/admin/members"
          onNavigate={router.push}
        />
        <KpiCard
          title="Active Members"
          value={stats.activeMembers}
          description="Currently active accounts"
          icon={<UserCheck className="size-5 text-sky-700" />}
          accentClassName="bg-sky-50"
          href="/admin/members?status=active"
          onNavigate={router.push}
        />
        <KpiCard
          title="Pending Activation"
          value={stats.pendingActivation}
          description="Awaiting account activation"
          icon={<Clock className="size-5 text-amber-700" />}
          accentClassName="bg-amber-50"
          href="/admin/members/pending"
          onNavigate={router.push}
        />
        <KpiCard
          title="Suspended Members"
          value={stats.suspendedMembers}
          description="Accounts marked suspended"
          icon={<UserX className="size-5 text-rose-700" />}
          accentClassName="bg-rose-50"
          href="/admin/members?status=suspended"
          onNavigate={router.push}
        />
      </section>

      <MemberMembershipStatusCard status={membershipStatus} />

      <MemberServicesCard />

      {progressionInsights ? (
        <ExecutiveProgressionInsightsPanel insights={progressionInsights} />
      ) : (
        <p className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          Membership Progression insights are temporarily unavailable.
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Welfare Support Records"
          value={welfareStats.totalRecords}
          description="All welfare support entries recorded"
          icon={<HandHeart className="size-5 text-emerald-700" />}
          accentClassName="bg-emerald-50"
          href="/admin/welfare-support"
          onNavigate={router.push}
        />
        <KpiCard
          title="Total Welfare Support Amount"
          value={formatCurrency(welfareStats.totalAmount)}
          description="Combined value of all support granted"
          icon={<HandHeart className="size-5 text-sky-700" />}
          accentClassName="bg-sky-50"
          href="/admin/welfare-support"
          onNavigate={router.push}
        />
        <KpiCard
          title="Members Assisted"
          value={welfareStats.membersAssisted}
          description="Unique members who received support"
          icon={<Users className="size-5 text-amber-700" />}
          accentClassName="bg-amber-50"
          href="/admin/welfare-support"
          onNavigate={router.push}
        />
        <KpiCard
          title="Published Announcements"
          value={publishedAnnouncementCount}
          description="Live portal announcements"
          icon={<Megaphone className="size-5 text-violet-700" />}
          accentClassName="bg-violet-50"
          href="/admin/announcements?status=published"
          onNavigate={router.push}
        />
      </section>

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Recent Notifications</CardTitle>
            <CardDescription>Latest unread profile change alerts</CardDescription>
          </div>
          <Link
            href="/admin/notifications"
            className="text-sm font-medium text-[#166534] hover:underline"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          <RecentNotifications notifications={recentNotifications} />
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Recent Announcements</CardTitle>
            <CardDescription>Latest published portal announcements</CardDescription>
          </div>
          <Link
            href="/admin/announcements"
            className="text-sm font-medium text-[#166534] hover:underline"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          <RecentAnnouncements announcements={recentAnnouncements} />
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Members</CardTitle>
            <CardDescription>Latest members added to the portal</CardDescription>
          </CardHeader>
          <CardContent>
            {recentMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            ) : (
              <div className="space-y-3">
                {recentMembers.map((member) => (
                  <Link
                    key={member.id}
                    href={`/admin/members/${member.id}`}
                    className="flex flex-col gap-2 rounded-xl border border-black/[0.06] px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {member.fullName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {member.serviceNumber} · {formatDisplayDate(member.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <RoleBadge role={member.role as UserRole} />
                      <StatusBadge status={member.status as UserStatus} />
                      <ActivationBadge
                        activationStatus={member.activationStatus as ActivationStatus}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common admin operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickActionLink
              href={canManage ? "/admin/members/new" : undefined}
              label="Add Member"
              description="Create a new welfare member record"
              disabled={!canManage}
            />
            <QuickActionLink
              href="/admin/members"
              label="View Members"
              description="Browse and manage all members"
            />
            <QuickActionLink
              href="/admin/claims/submitted"
              label="View Claims"
              description="Executive claims review queue"
            />
            <QuickActionLink
              href="/admin/claims/finance"
              label="View Finance Queue"
              description="Claims awaiting payment processing"
            />
            <QuickActionLink
              href="/admin/contributions"
              label="View Contributions"
              description="Contribution records and dues"
            />
            <QuickActionLink
              href="/admin/reports?tab=progression"
              label="View Progress Reports"
              description="Membership progression report and export"
            />
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            <CardTitle>Recent Activity</CardTitle>
          </div>
          <CardDescription>
            Member creation, status changes, and activation events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity recorded.</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-1 rounded-xl border border-black/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {activityDetail(item)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="size-3.5" />
                      {item.actorName?.trim() || "System"}
                    </span>
                    <span>{formatDisplayDate(item.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
