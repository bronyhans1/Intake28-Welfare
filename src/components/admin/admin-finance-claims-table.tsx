"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoadingButton } from "@/components/ui/loading-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { CLAIM_STATUS_LABELS, ClaimStatus } from "@/types/enums";
import type { ClaimListResult } from "@/lib/claims/claim-repository";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  { value: "", label: "All finance statuses" },
  {
    value: ClaimStatus.AWAITING_PAYMENT,
    label: CLAIM_STATUS_LABELS[ClaimStatus.AWAITING_PAYMENT],
  },
  {
    value: ClaimStatus.PAYMENT_PROCESSING,
    label: CLAIM_STATUS_LABELS[ClaimStatus.PAYMENT_PROCESSING],
  },
  { value: ClaimStatus.PAID, label: CLAIM_STATUS_LABELS[ClaimStatus.PAID] },
];

const SORT_OPTIONS = [
  { value: "claimNumber", label: "Claim Number" },
  { value: "memberName", label: "Member" },
  { value: "amount", label: "Amount" },
  { value: "paymentDate", label: "Payment Date" },
  { value: "paymentMethod", label: "Payment Method" },
];

interface AdminFinanceClaimsTableProps {
  data: ClaimListResult;
  search: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
}

export function AdminFinanceClaimsTable({
  data,
  search,
  status = "",
  sortBy = "claimNumber",
  sortDir = "asc",
}: AdminFinanceClaimsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(search);
  const [statusFilter, setStatusFilter] = useState(status);
  const [sortField, setSortField] = useState(sortBy);
  const [sortDirection, setSortDirection] = useState(sortDir);

  function applyFilters() {
    startTransition(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (sortField) params.set("sortBy", sortField);
      if (sortDirection) params.set("sortDir", sortDirection);
      const qs = params.toString();
      router.push(
        qs ? `/admin/claims/finance?${qs}` : "/admin/claims/finance",
      );
    });
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Finance Claims Queue</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 space-y-2">
            <Label htmlFor="financeSearch">Search</Label>
            <Input
              id="financeSearch"
              value={query}
              disabled={isPending}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters();
              }}
            />
          </div>
          <div className="min-w-[160px] space-y-2">
            <Label htmlFor="financeStatus">Status</Label>
            <select
              id="financeStatus"
              className="h-9 w-full rounded-lg border border-input px-2.5 text-sm"
              value={statusFilter}
              disabled={isPending}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[150px] space-y-2">
            <Label htmlFor="financeSort">Sort by</Label>
            <select
              id="financeSort"
              className="h-9 w-full rounded-lg border border-input px-2.5 text-sm"
              value={sortField}
              disabled={isPending}
              onChange={(event) => setSortField(event.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[120px] space-y-2">
            <Label htmlFor="financeSortDir">Order</Label>
            <select
              id="financeSortDir"
              className="h-9 w-full rounded-lg border border-input px-2.5 text-sm"
              value={sortDirection}
              disabled={isPending}
              onChange={(event) => setSortDirection(event.target.value)}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
          <LoadingButton
            type="button"
            loading={isPending}
            className="bg-[#166534] text-white hover:bg-[#14532d]"
            onClick={applyFilters}
          >
            Apply
          </LoadingButton>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Claims ({data.total})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.claims.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No claims in the finance queue.
            </p>
          ) : (
            data.claims.map((claim) => (
              <div
                key={claim.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-black/[0.06] px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {claim.claimNumber ?? claim.reference}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {claim.memberName} · {claim.claimTypeDisplayName} ·{" "}
                    {CLAIM_STATUS_LABELS[claim.status]}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Approved benefit: GHS{" "}
                    {(claim.approvedBenefitAmount ?? 0).toFixed(2)}
                    {claim.financeQueuedAt
                      ? ` · Queued ${formatDisplayDate(claim.financeQueuedAt)}`
                      : ""}
                  </p>
                </div>
                <Link
                  href={`/admin/claims/finance/${claim.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                  )}
                >
                  Open
                </Link>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
