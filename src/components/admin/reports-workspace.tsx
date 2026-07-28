"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CalendarClock, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { ContributionTypeBadge } from "@/components/admin/contributions-badge";
import { SupportTypeBadge } from "@/components/admin/welfare-support-badge";
import { ReportExportLink } from "@/components/loading/report-export-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatContributionTypeFilterLabel } from "@/lib/contributions/labels";
import type { DefaulterListResult } from "@/lib/finance/defaulters";
import type { ContributionListResult } from "@/lib/contributions/repository";
import type { FinancialSummaryReport, ReportsDashboardSummary } from "@/lib/reports/summary";
import type { ReportsPageQuery } from "@/lib/validators/reports";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";
import {
  ContributionType,
  WELFARE_SUPPORT_TYPE_LABELS,
  WelfareSupportType,
} from "@/types/enums";
import type { SerializedMember } from "@/types/user";
import type { WelfareSupportListResult } from "@/lib/welfare/repository";
import { formatReceiptContributionTypeLabel } from "@/lib/receipts/labels";
import type { ReceiptListResult } from "@/lib/receipts/repository";
import { cn } from "@/lib/utils";
import {
  MEMBERSHIP_PROGRESSION_STATUS_LABELS,
  MembershipProgressionStatus,
} from "@/types/enums";

type ProgressionReportResult = Awaited<
  ReturnType<
    typeof import("@/lib/reports/export/membership-progression").listMembershipProgressionReportRows
  >
>;

type OutstandingReportResult = Awaited<
  ReturnType<
    typeof import("@/lib/reports/export/outstanding-contributions").listOutstandingContributionsReportRows
  >
>;

interface ReportsWorkspaceProps {
  query: ReportsPageQuery;
  dashboardSummary: ReportsDashboardSummary;
  financialSummaryReport: FinancialSummaryReport;
  contributions: ContributionListResult;
  welfareSupport: WelfareSupportListResult;
  defaulters: DefaulterListResult;
  receipts: ReceiptListResult;
  progression: ProgressionReportResult;
  outstanding: OutstandingReportResult;
  members: SerializedMember[];
  canExport: boolean;
}

const FILTER_ALL = "all";
const TABS = [
  { id: "financial", label: "Financial Summary" },
  { id: "contributions", label: "Contributions" },
  { id: "welfare", label: "Welfare Support" },
  { id: "defaulters", label: "Defaulters" },
  { id: "receipts", label: "Receipts" },
  { id: "progression", label: "Membership Progression" },
  { id: "outstanding", label: "Outstanding Contributions" },
] as const;

function buildQuery(
  searchParams: URLSearchParams,
  updates: Record<string, string | undefined>,
) {
  const params = new URLSearchParams(searchParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (!value) params.delete(key);
    else params.set(key, value);
  }

  if (
    "month" in updates ||
    "year" in updates ||
    "memberId" in updates ||
    "contributionType" in updates ||
    "supportType" in updates ||
    "search" in updates ||
    "status" in updates
  ) {
    params.set("page", "1");
  }

  return params.toString();
}

function buildExportUrl(
  reportType:
    | "contributions"
    | "welfare_support"
    | "defaulters"
    | "receipts"
    | "membership_progression"
    | "outstanding_contributions",
  format: "csv" | "xlsx",
  searchParams: URLSearchParams,
) {
  const params = new URLSearchParams({ reportType, format });
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const memberId = searchParams.get("memberId");
  const contributionType = searchParams.get("contributionType");
  const supportType = searchParams.get("supportType");
  const search = searchParams.get("search");
  const status = searchParams.get("status");

  if (month) params.set("month", month);
  if (year) params.set("year", year);
  if (memberId) params.set("memberId", memberId);
  if (contributionType) params.set("contributionType", contributionType);
  if (supportType) params.set("supportType", supportType);
  if (search) params.set("search", search);
  if (status) params.set("status", status);

  return `/api/reports/export?${params.toString()}`;
}

function StatCard({
  title,
  value,
  description,
  icon,
  accentClassName,
  valueClassName,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  accentClassName: string;
  valueClassName?: string;
}) {
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

function ExportButtons({
  reportType,
  searchParams,
  canExport,
}: {
  reportType:
    | "contributions"
    | "welfare_support"
    | "defaulters"
    | "receipts"
    | "membership_progression"
    | "outstanding_contributions";
  searchParams: URLSearchParams;
  canExport: boolean;
}) {
  if (!canExport) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <ReportExportLink
        href={buildExportUrl(reportType, "csv", searchParams)}
        label="Export CSV"
      />
      <ReportExportLink
        href={buildExportUrl(reportType, "xlsx", searchParams)}
        label="Export Excel"
      />
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  disabled,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages} ({total} records)
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1 || disabled}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages || disabled}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function ReportsWorkspace({
  query,
  dashboardSummary,
  financialSummaryReport,
  contributions,
  welfareSupport,
  defaulters,
  receipts,
  progression,
  outstanding,
  members,
  canExport,
}: ReportsWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlMonth = searchParams.get("month") ?? "";
  const urlYear = searchParams.get("year") ?? "";
  const urlMemberId = searchParams.get("memberId") ?? FILTER_ALL;
  const urlContributionType = searchParams.get("contributionType") ?? FILTER_ALL;
  const urlSupportType = searchParams.get("supportType") ?? FILTER_ALL;
  const urlSearch = searchParams.get("search") ?? "";
  const urlStatus = searchParams.get("status") ?? FILTER_ALL;

  const [month, setMonth] = useState(urlMonth);
  const [year, setYear] = useState(urlYear);
  const [memberId, setMemberId] = useState(urlMemberId);
  const [contributionType, setContributionType] = useState(urlContributionType);
  const [supportType, setSupportType] = useState(urlSupportType);
  const [search, setSearch] = useState(urlSearch);
  const [status, setStatus] = useState(urlStatus);

  useEffect(() => { setMonth(urlMonth); }, [urlMonth]);
  useEffect(() => { setYear(urlYear); }, [urlYear]);
  useEffect(() => { setMemberId(urlMemberId); }, [urlMemberId]);
  useEffect(() => { setContributionType(urlContributionType); }, [urlContributionType]);
  useEffect(() => { setSupportType(urlSupportType); }, [urlSupportType]);
  useEffect(() => { setSearch(urlSearch); }, [urlSearch]);
  useEffect(() => { setStatus(urlStatus); }, [urlStatus]);

  function updateFilters(updates: Record<string, string | undefined>) {
    startTransition(() => {
      router.push(`/admin/reports?${buildQuery(searchParams, updates)}`);
    });
  }

  function switchTab(tab: ReportsPageQuery["tab"]) {
    updateFilters({ tab });
  }

  function goToPage(page: number) {
    updateFilters({ page: String(page) });
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Current Balance"
          value={dashboardSummary.currentBalance}
          description="Contributions minus welfare support"
          icon={<Wallet className="size-5 text-[#166534]" />}
          accentClassName="bg-[#166534]/10"
          valueClassName="text-[#166534]"
        />
        <StatCard
          title="Expected Amount"
          value={dashboardSummary.expectedAmount}
          description="Expected monthly dues this period"
          icon={<CalendarClock className="size-5 text-violet-700" />}
          accentClassName="bg-violet-50"
        />
        <StatCard
          title="Collected Amount"
          value={dashboardSummary.collectedAmount}
          description="Monthly dues collected this period"
          icon={<PiggyBank className="size-5 text-[#166534]" />}
          accentClassName="bg-[#166534]/10"
          valueClassName="text-[#166534]"
        />
        <StatCard
          title="Outstanding Amount"
          value={dashboardSummary.outstandingAmount}
          description="Expected minus collected monthly dues"
          icon={<Wallet className="size-5 text-amber-700" />}
          accentClassName="bg-amber-50"
        />
        <StatCard
          title="Collection Rate"
          value={dashboardSummary.collectionRate}
          description="Share of expected monthly dues collected"
          icon={<TrendingUp className="size-5 text-sky-700" />}
          accentClassName="bg-sky-50"
        />
      </section>

      <div className="flex flex-wrap gap-2 border-b border-black/[0.08] pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => switchTab(tab.id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              query.tab === tab.id
                ? "bg-[#166534] text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {query.tab === "financial" ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 xl:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="text-xl font-semibold">{financialSummaryReport.currentBalance}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Contributions</p>
              <p className="text-xl font-semibold">{financialSummaryReport.totalContributions}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Welfare Support</p>
              <p className="text-xl font-semibold">{financialSummaryReport.totalWelfareSupport}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expected Amount</p>
              <p className="text-xl font-semibold">{financialSummaryReport.expectedAmount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Collected Amount</p>
              <p className="text-xl font-semibold">{financialSummaryReport.collectedAmount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Outstanding Amount</p>
              <p className="text-xl font-semibold">{financialSummaryReport.outstandingAmount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Collection Rate</p>
              <p className="text-xl font-semibold">{financialSummaryReport.collectionRate}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {query.tab === "contributions" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="contributions-month">Month</Label>
                <Input
                  id="contributions-month"
                  type="number"
                  min={1}
                  max={12}
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  onBlur={() =>
                    updateFilters({ month: month || undefined, year: year || undefined })
                  }
                  placeholder="All"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contributions-year">Year</Label>
                <Input
                  id="contributions-year"
                  type="number"
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  onBlur={() =>
                    updateFilters({ month: month || undefined, year: year || undefined })
                  }
                  placeholder="All"
                />
              </div>
              <div className="space-y-2">
                <Label>Member</Label>
                <Select
                  value={memberId}
                  onValueChange={(value) => {
                    const next = value ?? FILTER_ALL;
                    setMemberId(next);
                    updateFilters({ memberId: next === FILTER_ALL ? undefined : next });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All members" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>All members</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.fullName} ({member.serviceNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Contribution Type</Label>
                <Select
                  value={contributionType}
                  onValueChange={(value) => {
                    const next = value ?? FILTER_ALL;
                    setContributionType(next);
                    updateFilters({
                      contributionType: next === FILTER_ALL ? undefined : next,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>All types</SelectItem>
                    {Object.values(ContributionType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {formatContributionTypeFilterLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ExportButtons
              reportType="contributions"
              searchParams={searchParams}
              canExport={canExport}
            />
          </div>

          <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contribution Type</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Service Number</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Date Recorded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contributions.records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No contribution records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  contributions.records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <ContributionTypeBadge contributionType={record.contributionType} />
                      </TableCell>
                      <TableCell className="font-medium">{record.memberName}</TableCell>
                      <TableCell>{record.serviceNumber}</TableCell>
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

          <Pagination
            page={contributions.page}
            totalPages={contributions.totalPages}
            total={contributions.total}
            onPageChange={goToPage}
            disabled={isPending}
          />
        </div>
      ) : null}

      {query.tab === "welfare" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="welfare-month">Month</Label>
                <Input
                  id="welfare-month"
                  type="number"
                  min={1}
                  max={12}
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  onBlur={() =>
                    updateFilters({ month: month || undefined, year: year || undefined })
                  }
                  placeholder="All"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="welfare-year">Year</Label>
                <Input
                  id="welfare-year"
                  type="number"
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  onBlur={() =>
                    updateFilters({ month: month || undefined, year: year || undefined })
                  }
                  placeholder="All"
                />
              </div>
              <div className="space-y-2">
                <Label>Member</Label>
                <Select
                  value={memberId}
                  onValueChange={(value) => {
                    const next = value ?? FILTER_ALL;
                    setMemberId(next);
                    updateFilters({ memberId: next === FILTER_ALL ? undefined : next });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All members" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>All members</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.fullName} ({member.serviceNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Support Type</Label>
                <Select
                  value={supportType}
                  onValueChange={(value) => {
                    const next = value ?? FILTER_ALL;
                    setSupportType(next);
                    updateFilters({ supportType: next === FILTER_ALL ? undefined : next });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>All types</SelectItem>
                    {Object.values(WelfareSupportType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {WELFARE_SUPPORT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ExportButtons
              reportType="welfare_support"
              searchParams={searchParams}
              canExport={canExport}
            />
          </div>

          <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Support Type</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Service Number</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date Recorded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {welfareSupport.records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No welfare support records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  welfareSupport.records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <SupportTypeBadge supportType={record.supportType} />
                      </TableCell>
                      <TableCell className="font-medium">{record.memberName}</TableCell>
                      <TableCell>{record.serviceNumber}</TableCell>
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

          <Pagination
            page={welfareSupport.page}
            totalPages={welfareSupport.totalPages}
            total={welfareSupport.total}
            onPageChange={goToPage}
            disabled={isPending}
          />
        </div>
      ) : null}

      {query.tab === "defaulters" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="defaulters-month">Month</Label>
                <Input
                  id="defaulters-month"
                  type="number"
                  min={1}
                  max={12}
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  onBlur={() =>
                    updateFilters({ month: month || undefined, year: year || undefined })
                  }
                  placeholder="Current"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaulters-year">Year</Label>
                <Input
                  id="defaulters-year"
                  type="number"
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  onBlur={() =>
                    updateFilters({ month: month || undefined, year: year || undefined })
                  }
                  placeholder="Current"
                />
              </div>
            </div>
            <ExportButtons
              reportType="defaulters"
              searchParams={searchParams}
              canExport={canExport}
            />
          </div>

          <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Outstanding Months</TableHead>
                  <TableHead>Months Owing</TableHead>
                  <TableHead>Outstanding Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defaulters.records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No members with outstanding contributions.
                    </TableCell>
                  </TableRow>
                ) : (
                  defaulters.records.map((record) => (
                    <TableRow key={record.memberId}>
                      <TableCell>
                        <p className="font-medium">{record.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {record.serviceNumber}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-[18rem] text-sm">
                        {record.outstandingMonthsDisplay}
                      </TableCell>
                      <TableCell>{record.outstandingMonths}</TableCell>
                      <TableCell className="font-medium text-[#166534]">
                        {formatCurrency(record.outstandingAmount)}
                      </TableCell>
                      <TableCell>{record.membershipStatusLabel}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination
            page={defaulters.page}
            totalPages={defaulters.totalPages}
            total={defaulters.total}
            onPageChange={goToPage}
            disabled={isPending}
          />
        </div>
      ) : null}

      {query.tab === "receipts" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="receipts-month">Month</Label>
                <Input
                  id="receipts-month"
                  type="number"
                  min={1}
                  max={12}
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  onBlur={() =>
                    updateFilters({ month: month || undefined, year: year || undefined })
                  }
                  placeholder="All"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receipts-year">Year</Label>
                <Input
                  id="receipts-year"
                  type="number"
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  onBlur={() =>
                    updateFilters({ month: month || undefined, year: year || undefined })
                  }
                  placeholder="All"
                />
              </div>
            </div>
            <ExportButtons
              reportType="receipts"
              searchParams={searchParams}
              canExport={canExport}
            />
          </div>

          <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt Number</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Contribution Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date Issued</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No receipts found.
                    </TableCell>
                  </TableRow>
                ) : (
                  receipts.records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.receiptNumber}</TableCell>
                      <TableCell>{record.memberName}</TableCell>
                      <TableCell>
                        {formatReceiptContributionTypeLabel(record.contributionType)}
                      </TableCell>
                      <TableCell>{formatCurrency(record.amount)}</TableCell>
                      <TableCell>{formatDisplayDate(record.issuedAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination
            page={receipts.page}
            totalPages={receipts.totalPages}
            total={receipts.total}
            onPageChange={goToPage}
            disabled={isPending}
          />
        </div>
      ) : null}

      {query.tab === "progression" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Membership Progression Engine snapshot — welfare points, benefit %,
              status, maturity, and contribution streaks.
            </p>
            <ExportButtons
              reportType="membership_progression"
              searchParams={searchParams}
              canExport={canExport}
            />
          </div>

          <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Welfare Points</TableHead>
                  <TableHead>Benefit %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Maturity</TableHead>
                  <TableHead>Consecutive</TableHead>
                  <TableHead>Missed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {progression.rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No progression records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  progression.rows.map((record) => (
                    <TableRow key={record.memberId}>
                      <TableCell>
                        <p className="font-medium">{record.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {record.serviceNumber}
                        </p>
                      </TableCell>
                      <TableCell>{record.welfarePoints}</TableCell>
                      <TableCell>{record.benefitPercentage}%</TableCell>
                      <TableCell>
                        {MEMBERSHIP_PROGRESSION_STATUS_LABELS[
                          record.membershipStatus as MembershipProgressionStatus
                        ] ?? record.membershipStatus}
                      </TableCell>
                      <TableCell>
                        {record.isMature ? "Mature" : "Not mature"}
                      </TableCell>
                      <TableCell>{record.consecutiveContributionMonths}</TableCell>
                      <TableCell>{record.consecutiveMissedMonths}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination
            page={progression.page}
            totalPages={progression.totalPages}
            total={progression.total}
            onPageChange={goToPage}
            disabled={isPending}
          />
        </div>
      ) : null}

      {query.tab === "outstanding" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Unpaid monthly dues from each member&apos;s join month through the
              current business month, with progression status.
            </p>
            <ExportButtons
              reportType="outstanding_contributions"
              searchParams={searchParams}
              canExport={canExport}
            />
          </div>

          <div className="grid gap-4 rounded-xl border border-black/[0.08] bg-white p-4 shadow-sm sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="outstanding-search">Search</Label>
              <Input
                id="outstanding-search"
                placeholder="Name or service number"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onBlur={() =>
                  updateFilters({
                    search: search.trim() || undefined,
                    page: "1",
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    updateFilters({
                      search: search.trim() || undefined,
                      page: "1",
                    });
                  }
                }}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="outstanding-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  const next = value ?? FILTER_ALL;
                  setStatus(next);
                  updateFilters({
                    status: next === FILTER_ALL ? undefined : next,
                    page: "1",
                  });
                }}
                disabled={isPending}
              >
                <SelectTrigger id="outstanding-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>All statuses</SelectItem>
                  <SelectItem value={MembershipProgressionStatus.ACTIVE}>
                    Active
                  </SelectItem>
                  <SelectItem value={MembershipProgressionStatus.DEFAULTING}>
                    Defaulting
                  </SelectItem>
                  <SelectItem value={MembershipProgressionStatus.LAPSED}>
                    Lapsed
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="outstanding-member">Member</Label>
              <Select
                value={memberId}
                onValueChange={(value) => {
                  const next = value ?? FILTER_ALL;
                  setMemberId(next);
                  updateFilters({
                    memberId: next === FILTER_ALL ? undefined : next,
                    page: "1",
                  });
                }}
                disabled={isPending}
              >
                <SelectTrigger id="outstanding-member">
                  <SelectValue placeholder="All members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>All members</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Outstanding Months</TableHead>
                  <TableHead>Total Months</TableHead>
                  <TableHead>Outstanding Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outstanding.rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No outstanding contributions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  outstanding.rows.map((record) => (
                    <TableRow key={record.memberId}>
                      <TableCell>
                        <p className="font-medium">{record.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {record.serviceNumber}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-[18rem] text-sm">
                          {record.outstandingMonthsDisplay}
                        </p>
                      </TableCell>
                      <TableCell>{record.totalOutstandingMonths}</TableCell>
                      <TableCell>
                        {formatCurrency(record.outstandingAmount)}
                      </TableCell>
                      <TableCell>{record.membershipStatusLabel}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination
            page={outstanding.page}
            totalPages={outstanding.totalPages}
            total={outstanding.total}
            onPageChange={goToPage}
            disabled={isPending}
          />
        </div>
      ) : null}
    </div>
  );
}
