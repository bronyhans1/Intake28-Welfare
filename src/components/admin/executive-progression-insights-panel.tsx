"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  TrendingUp,
  Users,
  UserX,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ExecutiveProgressionInsights } from "@/lib/dashboard/executive-progression-insights";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { cn } from "@/lib/utils";

interface ExecutiveProgressionInsightsPanelProps {
  insights: ExecutiveProgressionInsights;
}

function MiniStat({
  title,
  value,
  description,
  accentClassName,
  icon,
}: {
  title: string;
  value: number | string;
  description: string;
  accentClassName: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
      <CardContent className="flex items-start justify-between gap-3 pt-6">
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

function BenefitDistributionChart({
  buckets,
}: {
  buckets: ExecutiveProgressionInsights["benefitDistribution"];
}) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));

  return (
    <div className="space-y-3" role="img" aria-label="Benefit percentage distribution">
      {buckets.map((bucket) => {
        const width = Math.round((bucket.count / max) * 100);
        return (
          <div key={bucket.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{bucket.label}</span>
              <span className="text-muted-foreground">{bucket.count}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#166534] transition-[width] duration-500"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ExecutiveProgressionInsightsPanel({
  insights,
}: ExecutiveProgressionInsightsPanelProps) {
  return (
    <section className="space-y-6" aria-labelledby="progression-insights-heading">
      <div>
        <h2
          id="progression-insights-heading"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Membership Progression Insights
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Organisation-wide welfare progression health from the Membership
          Progression Engine. Account totals above are unchanged. Based on{" "}
          {insights.progressionRecords} progression record
          {insights.progressionRecords === 1 ? "" : "s"}.
        </p>
      </div>

      {/* 1. Membership Health — progression standing (not account Active/Suspended) */}
      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Membership Health Summary
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MiniStat
            title="Active Standing"
            value={insights.health.activeStanding}
            description="Progression status Active"
            accentClassName="bg-emerald-50"
            icon={<CheckCircle2 className="size-5 text-emerald-700" />}
          />
          <MiniStat
            title="Defaulting"
            value={insights.health.defaulting}
            description="Need contribution regularisation"
            accentClassName="bg-amber-50"
            icon={<AlertTriangle className="size-5 text-amber-700" />}
          />
          <MiniStat
            title="Lapsed"
            value={insights.health.lapsed}
            description="Reinstatement required"
            accentClassName="bg-rose-50"
            icon={<UserX className="size-5 text-rose-700" />}
          />
          <MiniStat
            title="Mature Members"
            value={insights.health.mature}
            description="Reached membership maturity"
            accentClassName="bg-sky-50"
            icon={<Award className="size-5 text-sky-700" />}
          />
          <MiniStat
            title="Not Yet Mature"
            value={insights.health.notYetMature}
            description="Still building foundation"
            accentClassName="bg-slate-100"
            icon={<Users className="size-5 text-slate-700" />}
          />
        </div>
      </div>

      {/* 2. Welfare Progress Overview */}
      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Welfare Progress Overview
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat
            title="Average Welfare Points"
            value={insights.overview.averageWelfarePoints}
            description="Across progression records"
            accentClassName="bg-emerald-50"
            icon={<TrendingUp className="size-5 text-emerald-700" />}
          />
          <MiniStat
            title="Average Benefit %"
            value={`${insights.overview.averageBenefitPercentage}%`}
            description="Mean benefit percentage"
            accentClassName="bg-sky-50"
            icon={<BarChart3 className="size-5 text-sky-700" />}
          />
          <MiniStat
            title="Highest Welfare Points"
            value={insights.overview.highestWelfarePoints}
            description="Top recorded points"
            accentClassName="bg-amber-50"
            icon={<Award className="size-5 text-amber-700" />}
          />
          <MiniStat
            title="At 100% Benefit"
            value={insights.overview.membersAtFullBenefit}
            description="Maximum benefit members"
            accentClassName="bg-emerald-50"
            icon={<CheckCircle2 className="size-5 text-emerald-700" />}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 3. Benefit Distribution */}
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Benefit Distribution</CardTitle>
            <CardDescription>
              Members grouped by benefit percentage bands
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BenefitDistributionChart buckets={insights.benefitDistribution} />
          </CardContent>
        </Card>

        {/* 4. Maturity Progress */}
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Maturity Progress</CardTitle>
            <CardDescription>Scheme maturity pipeline</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-emerald-50/80 p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Already mature
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">
                {insights.maturity.alreadyMature}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50/80 p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Approaching maturity
              </p>
              <p className="mt-2 text-2xl font-bold text-amber-900">
                {insights.maturity.approachingMaturity}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Zero contributions
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {insights.maturity.zeroContributions}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. Approaching Maturity list */}
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Members Approaching Maturity</CardTitle>
          <CardDescription>
            Members with 4 or 5 Welfare Points — close to claim eligibility
          </CardDescription>
        </CardHeader>
        <CardContent>
          {insights.approachingMaturityMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No members are currently at 4 or 5 Welfare Points.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/[0.08] text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Welfare Points</th>
                    <th className="py-2 pr-3 font-medium">Remaining</th>
                    <th className="py-2 font-medium">Expected Maturity</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.approachingMaturityMembers.map((member) => (
                    <tr
                      key={member.memberId}
                      className="border-b border-black/[0.05] last:border-0"
                    >
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/admin/members/${member.memberId}`}
                          className="font-medium text-[#166534] hover:underline"
                        >
                          {member.fullName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {member.serviceNumber}
                        </p>
                      </td>
                      <td className="py-2.5 pr-3">{member.welfarePoints}</td>
                      <td className="py-2.5 pr-3">
                        {member.remainingContributions}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {member.expectedMaturity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6. Defaulting Risk */}
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Defaulting Risk</CardTitle>
          <CardDescription>
            Outstanding contribution months from the Membership Progression Engine
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {insights.defaultingRisk.map((bucket) => (
            <div
              key={bucket.id}
              className="rounded-xl border border-black/[0.06] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{bucket.label}</p>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold">
                  {bucket.count}
                </span>
              </div>
              {bucket.members.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">None right now.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {bucket.members.map((member) => (
                    <li key={member.memberId} className="text-sm">
                      <Link
                        href={`/admin/members/${member.memberId}`}
                        className="font-medium text-[#166534] hover:underline"
                      >
                        {member.fullName}
                      </Link>
                      <span className="text-muted-foreground">
                        {" "}
                        · {member.serviceNumber}
                      </span>
                      {member.outstandingMonthLabels.length > 0 ? (
                        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          <p>
                            Outstanding Months:{" "}
                            {member.outstandingMonthsDisplay}
                          </p>
                          <p>
                            Months Owing: {member.outstandingContributionMonths}
                          </p>
                          <p>
                            Outstanding Balance:{" "}
                            {formatCurrency(member.outstandingAmount)}
                          </p>
                        </div>
                      ) : null}
                      <p className="mt-0.5 text-xs font-medium text-foreground">
                        Status:{" "}
                        {member.membershipStatus === "defaulting"
                          ? "DEFAULTING"
                          : member.membershipStatus === "lapsed"
                            ? "LAPSED"
                            : member.membershipStatus === "active"
                              ? "ACTIVE"
                              : member.membershipStatus}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 7. Contribution Consistency */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Contribution Consistency</CardTitle>
            <CardDescription>Streak health across the scheme</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-emerald-50/80 p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Longest streak
              </p>
              <p className="mt-1 text-3xl font-bold text-emerald-900">
                {insights.consistency.longestStreak}
              </p>
              <p className="text-xs text-muted-foreground">months</p>
            </div>
            <div className="rounded-xl bg-sky-50/80 p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Average streak
              </p>
              <p className="mt-1 text-3xl font-bold text-sky-900">
                {insights.consistency.averageStreak}
              </p>
              <p className="text-xs text-muted-foreground">months</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>Highest Consistency</CardTitle>
            <CardDescription>
              Members with the longest current contribution streaks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {insights.consistency.topMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No progression data yet.</p>
            ) : (
              <div className="space-y-2">
                {insights.consistency.topMembers.map((member) => (
                  <Link
                    key={member.memberId}
                    href={`/admin/members/${member.memberId}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] px-4 py-3 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{member.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.serviceNumber} · {member.welfarePoints} points
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-[#166534]">
                      {member.consecutiveContributionMonths} mo
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 8. Recent Progression Activity */}
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            <CardTitle>Recent Progression Activity</CardTitle>
          </div>
          <CardDescription>
            Current milestone and risk highlights from progression records (not a
            separate event log)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {insights.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No progression highlights to show yet.
            </p>
          ) : (
            <div className="space-y-3">
              {insights.recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-1 rounded-xl border border-black/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-sm text-muted-foreground">
                      <Link
                        href={`/admin/members/${item.memberId}`}
                        className="text-[#166534] hover:underline"
                      >
                        {item.fullName}
                      </Link>{" "}
                      ({item.serviceNumber}) · {item.detail}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.occurredAt ? formatDisplayDate(item.occurredAt) : "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
