"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, Coins, HandHeart, PiggyBank, TrendingUp, Users, Wallet } from "lucide-react";
import { ContributionTypeBadge } from "@/components/admin/contributions-badge";
import { SupportTypeBadge } from "@/components/admin/welfare-support-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ExpectedDuesDashboardSummary,
  FinanceDashboardSummary,
} from "@/lib/finance/dashboard";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";
import type { SerializedContribution } from "@/types/contribution";
import type { SerializedWelfareSupport } from "@/types/welfare-support";
import { cn } from "@/lib/utils";

interface FinanceDashboardOverviewProps {
  summary: FinanceDashboardSummary;
  expectedDues: ExpectedDuesDashboardSummary;
  recentContributions: SerializedContribution[];
  recentWelfareSupport: SerializedWelfareSupport[];
}

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  accentClassName: string;
  valueClassName?: string;
}

function StatCard({
  title,
  value,
  description,
  icon,
  accentClassName,
  valueClassName,
}: StatCardProps) {
  return (
    <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 pt-6">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p
            className={cn(
              "text-3xl font-bold tracking-tight text-foreground",
              valueClassName,
            )}
          >
            {value}
          </p>
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

export function FinanceDashboardOverview({
  summary,
  expectedDues,
  recentContributions,
  recentWelfareSupport,
}: FinanceDashboardOverviewProps) {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Current Balance"
          value={summary.currentBalance}
          description="Total contributions minus welfare support paid"
          icon={<Wallet className="size-5 text-[#166534]" />}
          accentClassName="bg-[#166534]/10"
          valueClassName="text-[#166534]"
        />
        <StatCard
          title="Total Contributions Collected"
          value={summary.totalContributionsCollected}
          description="All paid contribution amounts"
          icon={<Coins className="size-5 text-emerald-700" />}
          accentClassName="bg-emerald-50"
          valueClassName="text-[#166534]"
        />
        <StatCard
          title="Total Welfare Support Paid"
          value={summary.totalWelfareSupportPaid}
          description="Combined value of support granted"
          icon={<HandHeart className="size-5 text-sky-700" />}
          accentClassName="bg-sky-50"
        />
        <StatCard
          title="Members Contributed"
          value={summary.membersContributed}
          description="Unique members with paid contributions"
          icon={<Users className="size-5 text-amber-700" />}
          accentClassName="bg-amber-50"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Expected This Month"
          value={expectedDues.expectedThisMonth}
          description="Active members × monthly dues amount"
          icon={<CalendarClock className="size-5 text-violet-700" />}
          accentClassName="bg-violet-50"
        />
        <StatCard
          title="Collected This Month"
          value={expectedDues.collectedThisMonth}
          description="Monthly dues collected for the current month"
          icon={<PiggyBank className="size-5 text-[#166534]" />}
          accentClassName="bg-[#166534]/10"
          valueClassName="text-[#166534]"
        />
        <StatCard
          title="Outstanding This Month"
          value={expectedDues.outstandingThisMonth}
          description="Expected minus collected monthly dues"
          icon={<Wallet className="size-5 text-amber-700" />}
          accentClassName="bg-amber-50"
        />
        <StatCard
          title="Collection Rate"
          value={expectedDues.collectionRate}
          description="Share of expected monthly dues collected"
          icon={<TrendingUp className="size-5 text-sky-700" />}
          accentClassName="bg-sky-50"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Recent Contributions</CardTitle>
              <CardDescription>Latest contribution records</CardDescription>
            </div>
            <Link
              href="/admin/contributions"
              className="inline-flex items-center gap-1 text-sm font-medium text-[#166534] hover:underline"
            >
              View all
              <ArrowRight className="size-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-black/[0.08]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentContributions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No contribution records yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentContributions.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          <div>{record.memberName}</div>
                          <div className="text-xs text-muted-foreground">
                            {record.serviceNumber}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ContributionTypeBadge contributionType={record.contributionType} />
                        </TableCell>
                        <TableCell className="font-medium text-[#166534]">
                          {formatCurrency(record.amount)}
                        </TableCell>
                        <TableCell>{formatDisplayDate(record.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Recent Welfare Support</CardTitle>
              <CardDescription>Latest welfare support records</CardDescription>
            </div>
            <Link
              href="/admin/welfare-support"
              className="inline-flex items-center gap-1 text-sm font-medium text-[#166534] hover:underline"
            >
              View all
              <ArrowRight className="size-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-black/[0.08]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Support Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentWelfareSupport.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No welfare support records yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentWelfareSupport.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          <div>{record.memberName}</div>
                          <div className="text-xs text-muted-foreground">
                            {record.serviceNumber}
                          </div>
                        </TableCell>
                        <TableCell>
                          <SupportTypeBadge supportType={record.supportType} />
                        </TableCell>
                        <TableCell className="font-medium text-[#166534]">
                          {formatCurrency(record.amount)}
                        </TableCell>
                        <TableCell>{formatDisplayDate(record.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
