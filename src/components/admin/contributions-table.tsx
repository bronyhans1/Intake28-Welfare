"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Eye, Pencil, Search } from "lucide-react";
import { ContributionSourceBadge, ContributionStatusBadge, ContributionTypeBadge } from "@/components/admin/contributions-badge";
import { buttonVariants } from "@/components/ui/button";
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
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/currency";
import type { ContributionListResult } from "@/lib/contributions/repository";
import {
  formatContributionStatusFilterLabel,
  formatContributionTypeFilterLabel,
} from "@/lib/contributions/labels";
import {
  CONTRIBUTION_STATUS_LABELS,
  CONTRIBUTION_TYPE_LABELS,
  ContributionStatus,
  ContributionType,
} from "@/types/enums";

interface ContributionsTableProps {
  data: ContributionListResult;
  canManage: boolean;
}

const FILTER_ALL = "all";
const SEARCH_DEBOUNCE_MS = 400;

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
    "search" in updates ||
    "contributionType" in updates ||
    "status" in updates ||
    "month" in updates ||
    "year" in updates
  ) {
    params.set("page", "1");
  }

  return params.toString();
}

function parseNumberParam(value: string | null): string {
  return value && value.trim() ? value : "";
}

export function ContributionsTable({ data, canManage }: ContributionsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlSearch = searchParams.get("search") ?? "";
  const urlType = searchParams.get("contributionType") ?? FILTER_ALL;
  const urlStatus = searchParams.get("status") ?? FILTER_ALL;
  const urlMonth = parseNumberParam(searchParams.get("month"));
  const urlYear = parseNumberParam(searchParams.get("year"));

  const [search, setSearch] = useState(urlSearch);
  const [contributionType, setContributionType] = useState(urlType);
  const [status, setStatus] = useState(urlStatus);
  const [month, setMonth] = useState(urlMonth);
  const [year, setYear] = useState(urlYear);

  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);
  useEffect(() => {
    setContributionType(urlType);
  }, [urlType]);
  useEffect(() => {
    setStatus(urlStatus);
  }, [urlStatus]);
  useEffect(() => {
    setMonth(urlMonth);
  }, [urlMonth]);
  useEffect(() => {
    setYear(urlYear);
  }, [urlYear]);

  function updateFilters(updates: Record<string, string | undefined>) {
    startTransition(() => {
      router.push(`/admin/contributions?${buildQuery(searchParams, updates)}`);
    });
  }

  useEffect(() => {
    if (search === urlSearch) return;
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.push(
          `/admin/contributions?${buildQuery(searchParamsRef.current, {
            search: search || undefined,
          })}`,
        );
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search, urlSearch, router]);

  function handleTypeChange(value: string | null) {
    const next = value ?? FILTER_ALL;
    setContributionType(next);
    updateFilters({
      contributionType: next === FILTER_ALL ? undefined : next,
    });
  }

  function handleStatusChange(value: string | null) {
    const next = value ?? FILTER_ALL;
    setStatus(next);
    updateFilters({ status: next === FILTER_ALL ? undefined : next });
  }

  function handleMonthChange(value: string | null) {
    const next = value ?? "";
    setMonth(next);
    updateFilters({ month: next ? next : undefined });
  }

  function handleYearChange(value: string | null) {
    const next = value ?? "";
    setYear(next);
    updateFilters({ year: next ? next : undefined });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full max-w-sm space-y-1.5">
          <Label htmlFor="contrib-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="contrib-search"
              className="pl-8"
              placeholder="Search member, service number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="contrib-filter-type">Contribution Type</Label>
            <Select value={contributionType} onValueChange={handleTypeChange}>
              <SelectTrigger id="contrib-filter-type" className="w-[200px]">
                <SelectValue>
                  {formatContributionTypeFilterLabel(contributionType)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>All Types</SelectItem>
                {(Object.keys(CONTRIBUTION_TYPE_LABELS) as ContributionType[]).map(
                  (type) => (
                    <SelectItem key={type} value={type}>
                      {CONTRIBUTION_TYPE_LABELS[type]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contrib-filter-status">Status</Label>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger id="contrib-filter-status" className="w-[160px]">
                <SelectValue>
                  {formatContributionStatusFilterLabel(status)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>All Statuses</SelectItem>
                {(Object.keys(CONTRIBUTION_STATUS_LABELS) as ContributionStatus[]).map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {CONTRIBUTION_STATUS_LABELS[s]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contrib-filter-month">Month</Label>
            <Select value={month || FILTER_ALL} onValueChange={handleMonthChange}>
              <SelectTrigger id="contrib-filter-month" className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>All</SelectItem>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contrib-filter-year">Year</Label>
            <Select value={year || FILTER_ALL} onValueChange={handleYearChange}>
              <SelectTrigger id="contrib-filter-year" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>All</SelectItem>
                {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i).map(
                  (y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Service Number</TableHead>
              <TableHead>Contribution Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Recorded By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                  No contribution records found.
                </TableCell>
              </TableRow>
            ) : (
              data.records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.memberName}</TableCell>
                  <TableCell>{record.serviceNumber}</TableCell>
                  <TableCell>
                    <ContributionTypeBadge contributionType={record.contributionType} />
                  </TableCell>
                  <TableCell>{formatCurrency(record.amount)}</TableCell>
                  <TableCell>{record.month}</TableCell>
                  <TableCell>{record.year}</TableCell>
                  <TableCell>
                    <ContributionStatusBadge status={record.status} />
                  </TableCell>
                  <TableCell>
                    <ContributionSourceBadge source={record.source} />
                  </TableCell>
                  <TableCell>{record.recordedByName}</TableCell>
                  <TableCell>{formatDisplayDate(record.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/contributions/${record.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                        aria-label={`View contribution record for ${record.memberName}`}
                      >
                        <Eye className="size-3.5" />
                        View
                      </Link>
                      {canManage ? (
                        <Link
                          href={`/admin/contributions/${record.id}/edit`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                          aria-label={`Edit contribution record for ${record.memberName}`}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Link>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          Showing {data.records.length} of {data.total} records
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={data.page <= 1 || isPending}
            onClick={() => updateFilters({ page: String(Math.max(1, data.page - 1)) })}
          >
            Previous
          </Button>
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={data.page >= data.totalPages || isPending}
            onClick={() =>
              updateFilters({ page: String(Math.min(data.totalPages, data.page + 1)) })
            }
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

