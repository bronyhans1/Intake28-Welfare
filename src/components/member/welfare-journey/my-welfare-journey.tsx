"use client";

import Link from "next/link";
import { TimeOfDayGreeting } from "@/components/dashboard/time-of-day-greeting";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { cn } from "@/lib/utils";
import {
  CLAIM_STATUS_LABELS,
  MEMBERSHIP_PROGRESSION_STATUS_LABELS,
  MembershipProgressionStatus,
  type ClaimStatus,
} from "@/types/enums";
import type { WelfareJourneyDashboard } from "@/types/welfare-journey";
import {
  Award,
  CheckCircle2,
  Circle,
  HeartHandshake,
  Sparkles,
  TrendingUp,
} from "lucide-react";

interface MyWelfareJourneyProps {
  journey: WelfareJourneyDashboard;
}

function toneClasses(tone: string): string {
  switch (tone) {
    case "warning":
      return "border-amber-200 bg-amber-50/90 text-amber-950";
    case "danger":
      return "border-rose-200 bg-rose-50/90 text-rose-950";
    case "celebration":
      return "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 text-emerald-950";
    case "success":
      return "border-emerald-200 bg-emerald-50/80 text-emerald-950";
    default:
      return "border-sky-200 bg-sky-50/80 text-sky-950";
  }
}

function statusPillClasses(status: string): string {
  if (status === MembershipProgressionStatus.ACTIVE) {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === MembershipProgressionStatus.DEFAULTING) {
    return "bg-amber-100 text-amber-900";
  }
  if (status === MembershipProgressionStatus.LAPSED) {
    return "bg-rose-100 text-rose-900";
  }
  return "bg-slate-100 text-slate-800";
}

function CircularBenefitProgress({
  benefitPercentage,
  welfarePoints,
  maxPoints,
}: {
  benefitPercentage: number;
  welfarePoints: number;
  maxPoints: number;
}) {
  const size = 160;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, benefitPercentage));
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative"
        style={{ width: size, height: size }}
        role="img"
        aria-label={`Benefit percentage ${pct} percent, welfare points ${welfarePoints} of ${maxPoints}`}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-slate-100"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-[#166534] transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-bold tracking-tight text-[#14532d]">
            {pct}%
          </p>
          <p className="text-xs font-medium text-muted-foreground">
            {welfarePoints} / {maxPoints}
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Benefit percentage</p>
    </div>
  );
}

function PointsProgressBar({
  welfarePoints,
  maxPoints,
  maturityPoints,
}: {
  welfarePoints: number;
  maxPoints: number;
  maturityPoints: number;
}) {
  const pct = Math.max(0, Math.min(100, (welfarePoints / maxPoints) * 100));
  const maturityPct = (maturityPoints / maxPoints) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">Welfare Points</span>
        <span className="text-muted-foreground">
          {welfarePoints} / {maxPoints}
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#166534] transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-amber-500"
          style={{ left: `${maturityPct}%` }}
          title="Membership Maturity (6 points)"
          aria-hidden
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Amber marker: Membership Maturity at {maturityPoints} Welfare Points
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

export function MyWelfareJourney({ journey }: MyWelfareJourneyProps) {
  const { progression } = journey;
  const statusLabel =
    MEMBERSHIP_PROGRESSION_STATUS_LABELS[
      progression.membershipStatus as keyof typeof MEMBERSHIP_PROGRESSION_STATUS_LABELS
    ] ?? progression.membershipStatus;

  return (
    <section
      id="welfare-journey"
      className="space-y-6"
      aria-labelledby="welfare-journey-heading"
    >
      {/* 1. Welcome */}
      <header className="space-y-2">
        <TimeOfDayGreeting firstName={journey.firstName} />
        <div>
          <h1
            id="welfare-journey-heading"
            className="text-2xl font-bold tracking-tight text-[#14532d] sm:text-3xl"
          >
            My Welfare Journey
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back.</p>
          <p className="text-sm text-muted-foreground">
            Here&apos;s your Welfare Journey.
          </p>
        </div>
      </header>

      {journey.hasZeroContributions ? (
        <Card className="rounded-2xl border border-sky-200 bg-sky-50/70 shadow-sm">
          <CardContent className="flex gap-3 p-5 sm:p-6">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
            <div className="space-y-1 text-sm text-sky-950">
              <p className="font-semibold">Welcome.</p>
              <p>Your welfare journey has just begun.</p>
              <p>
                Make your first successful contribution to begin earning Welfare
                Points.
              </p>
              <Link
                href="/portal/contributions"
                className="inline-flex pt-1 font-medium text-[#166534] hover:underline"
              >
                Go to Contributions →
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 2. Insight */}
      <Card
        className={cn(
          "rounded-2xl border shadow-sm",
          toneClasses(journey.insight.tone),
        )}
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <HeartHandshake className="h-5 w-5" aria-hidden />
            {journey.insight.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {journey.insight.messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
          {journey.insight.category === "starter" ||
          journey.insight.category === "mature" ||
          journey.insight.category === "growing" ||
          journey.insight.category === "gold" ||
          journey.insight.category === "platinum" ? (
            <p className="pt-1 font-medium">
              Current Welfare Points: {progression.welfarePoints}
              {progression.benefitPercentage > 0
                ? ` · Benefit ${progression.benefitPercentage}%`
                : ""}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* 3. Progress Summary + 9. Badge */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>Progress Summary</CardTitle>
            <CardDescription>
              Your membership position from the Progression Engine.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Membership Status
                </dt>
                <dd className="mt-1">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      statusPillClasses(progression.membershipStatus),
                    )}
                  >
                    {statusLabel}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Membership Maturity
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  {progression.isMature ? (
                    <span className="text-emerald-700">Mature</span>
                  ) : (
                    <span className="text-amber-700">Not yet mature</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Claim Eligibility
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  {progression.eligibleToClaim ? (
                    <span className="text-emerald-700">Eligible to claim</span>
                  ) : (
                    <span className="text-slate-600">Not eligible yet</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Welfare Points
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  {progression.welfarePoints} / {journey.maxWelfarePoints}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Benefit Percentage
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  {progression.benefitPercentage}%
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Member Since
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  {journey.memberSince
                    ? formatDisplayDate(journey.memberSince)
                    : "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-black/[0.08] bg-gradient-to-br from-white to-emerald-50/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-[#166534]" aria-hidden />
              Achievement Badge
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2 py-4 text-center">
            <span className="text-5xl" aria-hidden>
              {journey.badge.emoji}
            </span>
            <p className="text-lg font-semibold text-[#14532d]">
              {journey.badge.label}
            </p>
            <p className="text-sm text-muted-foreground">
              {journey.badge.description}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 4. Visualization */}
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Welfare Progress</CardTitle>
          <CardDescription>
            Benefit percentage and progress toward 36 Welfare Points.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
          <CircularBenefitProgress
            benefitPercentage={progression.benefitPercentage}
            welfarePoints={progression.welfarePoints}
            maxPoints={journey.maxWelfarePoints}
          />
          <PointsProgressBar
            welfarePoints={progression.welfarePoints}
            maxPoints={journey.maxWelfarePoints}
            maturityPoints={journey.maturityPoints}
          />
        </CardContent>
      </Card>

      {/* 5. Next Milestone + 8. Streak */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#166534]" aria-hidden />
              Next Milestone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">Current</p>
                <p className="font-semibold">
                  {journey.nextMilestone.currentPoints} Welfare Points
                </p>
                <p className="text-[#166534]">
                  {journey.nextMilestone.currentBenefitPercentage}%
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50/80 p-3">
                <p className="text-xs text-muted-foreground">Next</p>
                <p className="font-semibold">
                  {journey.nextMilestone.nextPoints != null
                    ? `${journey.nextMilestone.nextPoints} Welfare Points`
                    : "Maximum reached"}
                </p>
                <p className="text-[#166534]">
                  {journey.nextMilestone.nextBenefitPercentage != null
                    ? `${journey.nextMilestone.nextBenefitPercentage}%`
                    : "100%"}
                </p>
              </div>
            </div>
            <p className="font-medium text-foreground">
              {journey.nextMilestone.headline}
            </p>
            <p className="text-muted-foreground">{journey.nextMilestone.detail}</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Contribution Streak</CardTitle>
            <CardDescription>Celebrate consistency.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-center">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Current streak
              </p>
              <p className="mt-2 text-3xl font-bold text-[#14532d]">
                {journey.streak.currentMonths}
              </p>
              <p className="text-sm text-muted-foreground">
                Month{journey.streak.currentMonths === 1 ? "" : "s"}
              </p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 text-center">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Best streak
              </p>
              <p className="mt-2 text-3xl font-bold text-amber-900">
                {journey.streak.bestMonths}
              </p>
              <p className="text-sm text-muted-foreground">
                Month{journey.streak.bestMonths === 1 ? "" : "s"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 7. Contribution Statistics */}
      <div>
        <h3 className="mb-3 text-lg font-semibold tracking-tight">
          Contribution Statistics
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Successful Contributions"
            value={progression.successfulContributionMonths}
          />
          <StatCard
            label="Consecutive Contributions"
            value={progression.consecutiveContributionMonths}
          />
          <StatCard
            label="Outstanding Months"
            value={progression.outstandingContributionMonths ?? 0}
          />
          <StatCard label="Membership Status" value={statusLabel} />
        </div>
      </div>

      {journey.outstandingContributionLabels.length > 0 ? (
        <Card className="rounded-2xl border border-amber-200 bg-amber-50/70 shadow-sm">
          <CardHeader>
            <CardTitle>Outstanding Contributions</CardTitle>
            <CardDescription>
              Clear unpaid months to restore Active standing and protect claim
              eligibility.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground">
              {journey.outstandingContributionLabels.join(" • ")}
            </p>
            <Link
              href="/portal/contributions"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#166534] px-4 text-sm font-medium text-white hover:bg-[#14532d]"
            >
              Pay Now
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {/* 6. Estimated Claim Benefits */}
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Estimated Claim Benefits</CardTitle>
          <CardDescription>
            Read-only estimates using your current benefit percentage and each
            claim type ceiling. Not a guarantee of approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {journey.estimatedBenefits.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active claim types with a configured ceiling are available yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/[0.08] text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Claim Type</th>
                    <th className="py-2 pr-3 font-medium">Claim Ceiling</th>
                    <th className="py-2 font-medium">Estimated Benefit</th>
                  </tr>
                </thead>
                <tbody>
                  {journey.estimatedBenefits.map((row) => (
                    <tr
                      key={row.claimTypeCode}
                      className="border-b border-black/[0.05] last:border-0"
                    >
                      <td className="py-2.5 pr-3 font-medium text-foreground">
                        {row.claimTypeDisplayName}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        GHS {row.claimCeiling.toFixed(2)}
                      </td>
                      <td className="py-2.5 font-semibold text-[#166534]">
                        GHS {row.estimatedBenefit.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 10. Timeline */}
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Welfare Journey Timeline</CardTitle>
          <CardDescription>Milestones on your path.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-3">
            {journey.timeline.map((item) => (
              <li key={item.id} className="flex items-start gap-3 text-sm">
                {item.completed ? (
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                    aria-label="Completed"
                  />
                ) : (
                  <Circle
                    className="mt-0.5 h-5 w-5 shrink-0 text-slate-300"
                    aria-label="Upcoming"
                  />
                )}
                <div>
                  <p
                    className={cn(
                      "font-medium",
                      item.completed ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {item.completed ? "✓ " : ""}
                    {item.label}
                  </p>
                  {item.date ? (
                    <p className="text-xs text-muted-foreground">
                      {formatDisplayDate(item.date)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          {journey.nextTimelineMilestone ? (
            <div className="rounded-xl border border-dashed border-[#166534]/30 bg-emerald-50/40 px-4 py-3 text-sm">
              <p className="font-medium text-[#14532d]">Next milestone</p>
              <p className="text-muted-foreground">
                {journey.nextTimelineMilestone.label}
              </p>
            </div>
          ) : (
            <p className="text-sm font-medium text-emerald-700">
              You have completed every journey milestone shown here.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 11. Membership Status Information */}
      <Card
        className={cn(
          "rounded-2xl border shadow-sm",
          toneClasses(journey.statusInfo.tone),
        )}
      >
        <CardHeader>
          <CardTitle>{journey.statusInfo.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{journey.statusInfo.description}</p>
        </CardContent>
      </Card>

      {/* 12. Recent Claims */}
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>Recent Claims</CardTitle>
            <CardDescription>Your latest welfare claims.</CardDescription>
          </div>
          <Link
            href="/portal/claims"
            className="text-sm font-medium text-[#166534] hover:underline"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {journey.recentClaims.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/[0.1] bg-slate-50/80 px-4 py-6 text-sm text-muted-foreground">
              <p>You haven&apos;t submitted any welfare claims yet.</p>
              <p className="mt-1">
                Once you&apos;re eligible, your submitted claims will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/[0.08] text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Claim Type</th>
                    <th className="py-2 pr-3 font-medium">Submission Date</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Approved Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {journey.recentClaims.map((claim) => (
                    <tr
                      key={claim.id}
                      className="border-b border-black/[0.05] last:border-0"
                    >
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/portal/claims/${claim.id}`}
                          className="font-medium text-[#166534] hover:underline"
                        >
                          {claim.claimTypeDisplayName}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {claim.submittedAt
                          ? formatDisplayDate(claim.submittedAt)
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        {CLAIM_STATUS_LABELS[claim.status as ClaimStatus] ??
                          String(claim.status)}
                      </td>
                      <td className="py-2.5">
                        {claim.approvedAmount != null
                          ? `GHS ${claim.approvedAmount.toFixed(2)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 14. Education */}
      <Card className="rounded-2xl border border-black/[0.08] bg-gradient-to-br from-[#f0fdf4] via-white to-sky-50 shadow-sm">
        <CardHeader>
          <CardTitle>Why Consistency Matters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground/90">
          <p>
            Regular monthly contributions increase Welfare Points, improve Benefit
            Percentage, and strengthen both your protection and the welfare
            scheme.
          </p>
          <p className="font-medium text-[#14532d]">
            Thank you for being part of GIS Intake 28 Welfare. Every consistent
            contribution builds a stronger future for you and your peers.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
