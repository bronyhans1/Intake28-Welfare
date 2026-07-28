import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContributionSourceBadge, ContributionTypeBadge } from "@/components/admin/contributions-badge";
import {
  getMemberContributionDashboardDisplay,
  MEMBER_CONTRIBUTIONS_PATH,
} from "@/lib/contributions/member-dashboard-summary";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";
import type { ContributionStats } from "@/lib/contributions/repository";
import type { SerializedContribution } from "@/types/contribution";

export { MEMBER_CONTRIBUTIONS_PATH };

interface MemberContributionsDashboardCardProps {
  stats: ContributionStats;
  lastContributionDate: string | null;
}

export function MemberContributionsDashboardCard({
  stats,
  lastContributionDate,
}: MemberContributionsDashboardCardProps) {
  const display = getMemberContributionDashboardDisplay(stats, lastContributionDate);

  return (
    <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
      <CardHeader>
        <CardTitle>{display.title}</CardTitle>
        <CardDescription>
          {display.hasContributions
            ? "Your welfare scheme contribution summary."
            : "Track your monthly dues and other contributions."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {display.hasContributions ? (
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Total Contributions
              </dt>
              <dd className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                {display.totalContributions}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Total Amount Paid
              </dt>
              <dd className="mt-1 text-2xl font-bold tracking-tight text-[#166534]">
                {display.totalAmountPaid}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Last Contribution Date
              </dt>
              <dd className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                {display.lastContributionDate}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{display.emptyMessage}</p>
        )}

        <Link
          href={display.linkHref}
          className={buttonVariants({
            className: "bg-[#166534] text-white hover:bg-[#14532d]",
          })}
        >
          {display.linkLabel}
        </Link>
      </CardContent>
    </Card>
  );
}

interface MemberContributionsSummaryProps {
  stats: ContributionStats;
  lastContributionDate: string | null;
}

export function MemberContributionsSummary({
  stats,
  lastContributionDate,
}: MemberContributionsSummaryProps) {
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      <Card className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground">Total Contributions</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            {stats.totalContributions}
          </p>
        </CardContent>
      </Card>
      <Card className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground">Total Amount Paid</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-[#166534]">
            {formatCurrency(stats.totalAmountCollected)}
          </p>
        </CardContent>
      </Card>
      <Card className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground">Last Contribution Date</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            {lastContributionDate ? formatDisplayDate(lastContributionDate) : "—"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface MemberContributionsTableProps {
  records: SerializedContribution[];
}

export function MemberContributionsTable({ records }: MemberContributionsTableProps) {
  return (
    <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contribution Type</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Month</TableHead>
            <TableHead>Year</TableHead>
            <TableHead>Date Recorded</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                No contributions recorded yet.
              </TableCell>
            </TableRow>
          ) : (
            records.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <ContributionTypeBadge contributionType={record.contributionType} />
                </TableCell>
                <TableCell>
                  <ContributionSourceBadge source={record.source} />
                </TableCell>
                <TableCell className="font-medium text-[#166534]">
                  {formatCurrency(record.amount)}
                </TableCell>
                <TableCell>{record.month}</TableCell>
                <TableCell>{record.year}</TableCell>
                <TableCell>{formatDisplayDate(record.createdAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
