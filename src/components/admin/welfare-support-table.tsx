"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Eye, Pencil, Search } from "lucide-react";
import { SupportStatusBadge, SupportTypeBadge } from "@/components/admin/welfare-support-badge";
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
import type { WelfareSupportListResult } from "@/lib/welfare/repository";
import {
  WELFARE_SUPPORT_TYPE_LABELS,
  WelfareSupportStatus,
  WelfareSupportType,
} from "@/types/enums";
import { cn } from "@/lib/utils";

interface WelfareSupportTableProps {
  data: WelfareSupportListResult;
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
  if ("search" in updates || "supportType" in updates || "status" in updates) {
    params.set("page", "1");
  }
  return params.toString();
}

export function WelfareSupportTable({ data, canManage }: WelfareSupportTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlSearch = searchParams.get("search") ?? "";
  const urlType = searchParams.get("supportType") ?? FILTER_ALL;
  const urlStatus = searchParams.get("status") ?? FILTER_ALL;

  const [search, setSearch] = useState(urlSearch);
  const [supportType, setSupportType] = useState(urlType);
  const [status, setStatus] = useState(urlStatus);

  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  useEffect(() => { setSearch(urlSearch); }, [urlSearch]);
  useEffect(() => { setSupportType(urlType); }, [urlType]);
  useEffect(() => { setStatus(urlStatus); }, [urlStatus]);

  function updateFilters(updates: Record<string, string | undefined>) {
    startTransition(() => {
      router.push(`/admin/welfare-support?${buildQuery(searchParams, updates)}`);
    });
  }

  useEffect(() => {
    if (search === urlSearch) return;
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.push(
          `/admin/welfare-support?${buildQuery(searchParamsRef.current, { search: search || undefined })}`,
        );
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search, urlSearch, router]);

  function handleTypeChange(value: string | null) {
    const next = value ?? FILTER_ALL;
    setSupportType(next);
    updateFilters({ supportType: next === FILTER_ALL ? undefined : next });
  }

  function handleStatusChange(value: string | null) {
    const next = value ?? FILTER_ALL;
    setStatus(next);
    updateFilters({ status: next === FILTER_ALL ? undefined : next });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full max-w-sm space-y-1.5">
          <Label htmlFor="ws-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="ws-search"
              className="pl-8"
              placeholder="Search member, service number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ws-filter-type">Support Type</Label>
            <Select value={supportType} onValueChange={handleTypeChange}>
              <SelectTrigger id="ws-filter-type" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>All Types</SelectItem>
                {(Object.keys(WELFARE_SUPPORT_TYPE_LABELS) as WelfareSupportType[]).map(
                  (type) => (
                    <SelectItem key={type} value={type}>
                      {WELFARE_SUPPORT_TYPE_LABELS[type]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ws-filter-status">Status</Label>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger id="ws-filter-status" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>All Statuses</SelectItem>
                <SelectItem value={WelfareSupportStatus.APPROVED}>Approved</SelectItem>
                <SelectItem value={WelfareSupportStatus.PENDING}>Pending</SelectItem>
                <SelectItem value={WelfareSupportStatus.PAID}>Paid</SelectItem>
                <SelectItem value={WelfareSupportStatus.CANCELLED}>Cancelled</SelectItem>
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
              <TableHead>Support Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Recorded By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No welfare support records found.
                </TableCell>
              </TableRow>
            ) : (
              data.records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.memberName}</TableCell>
                  <TableCell>{record.serviceNumber}</TableCell>
                  <TableCell>
                    <SupportTypeBadge supportType={record.supportType} />
                  </TableCell>
                  <TableCell>{formatCurrency(record.amount)}</TableCell>
                  <TableCell>
                    <SupportStatusBadge status={record.status} />
                  </TableCell>
                  <TableCell>{record.recordedByName}</TableCell>
                  <TableCell>{formatDisplayDate(record.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/welfare-support/${record.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                        aria-label={`View welfare support record for ${record.memberName}`}
                      >
                        <Eye className="size-3.5" />
                        View
                      </Link>
                      {canManage ? (
                        <Link
                          href={`/admin/welfare-support/${record.id}/edit`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                          aria-label={`Edit welfare support record for ${record.memberName}`}
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
