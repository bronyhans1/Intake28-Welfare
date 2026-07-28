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

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All statuses" },
  { value: ClaimStatus.SUBMITTED, label: CLAIM_STATUS_LABELS[ClaimStatus.SUBMITTED] },
  {
    value: ClaimStatus.NEEDS_REVISION,
    label: CLAIM_STATUS_LABELS[ClaimStatus.NEEDS_REVISION],
  },
  {
    value: ClaimStatus.UNDER_REVIEW,
    label: CLAIM_STATUS_LABELS[ClaimStatus.UNDER_REVIEW],
  },
  {
    value: ClaimStatus.RECOMMENDED,
    label: CLAIM_STATUS_LABELS[ClaimStatus.RECOMMENDED],
  },
  { value: ClaimStatus.APPROVED, label: CLAIM_STATUS_LABELS[ClaimStatus.APPROVED] },
  {
    value: ClaimStatus.AWAITING_PAYMENT,
    label: CLAIM_STATUS_LABELS[ClaimStatus.AWAITING_PAYMENT],
  },
  {
    value: ClaimStatus.PAYMENT_PROCESSING,
    label: CLAIM_STATUS_LABELS[ClaimStatus.PAYMENT_PROCESSING],
  },
  { value: ClaimStatus.PAID, label: CLAIM_STATUS_LABELS[ClaimStatus.PAID] },
  { value: ClaimStatus.REJECTED, label: CLAIM_STATUS_LABELS[ClaimStatus.REJECTED] },
];

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "submissionDate", label: "Submission Date" },
  { value: "claimNumber", label: "Claim Number" },
  { value: "claimType", label: "Claim Type" },
  { value: "memberName", label: "Member Name" },
];

interface AdminSubmittedClaimsTableProps {
  data: ClaimListResult;
  search: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
}

export function AdminSubmittedClaimsTable({
  data,
  search,
  status = "",
  sortBy = "submissionDate",
  sortDir = "desc",
}: AdminSubmittedClaimsTableProps) {
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
      if (sortField && sortField !== "submissionDate") {
        params.set("sortBy", sortField);
      }
      if (sortDirection && sortDirection !== "desc") {
        params.set("sortDir", sortDirection);
      }
      const qs = params.toString();
      router.push(
        qs ? `/admin/claims/submitted?${qs}` : "/admin/claims/submitted",
      );
    });
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Search & Filter Claims</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1 space-y-2">
            <Label htmlFor="submittedSearch">
              Claim Number, Member, Type, Executive, or Status
            </Label>
            <Input
              id="submittedSearch"
              value={query}
              disabled={isPending}
              placeholder="GIS-2026-00001"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters();
              }}
            />
          </div>
          <div className="min-w-[160px] space-y-2">
            <Label htmlFor="statusFilter">Status</Label>
            <select
              id="statusFilter"
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
          <div className="min-w-[160px] space-y-2">
            <Label htmlFor="sortBy">Sort by</Label>
            <select
              id="sortBy"
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
            <Label htmlFor="sortDir">Order</Label>
            <select
              id="sortDir"
              className="h-9 w-full rounded-lg border border-input px-2.5 text-sm"
              value={sortDirection}
              disabled={isPending}
              onChange={(event) => setSortDirection(event.target.value)}
            >
              <option value="desc">Newest / Z–A</option>
              <option value="asc">Oldest / A–Z</option>
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
              No claims found for the selected filters.
            </p>
          ) : (
            data.claims.map((claim) => (
              <div
                key={claim.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-black/[0.06] px-4 py-3"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {claim.claimNumber ?? claim.reference}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {claim.memberName} ({claim.serviceNumber}) ·{" "}
                    {claim.claimTypeDisplayName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Incident{" "}
                    {claim.incidentDate
                      ? formatDisplayDate(claim.incidentDate)
                      : "—"}{" "}
                    · Submitted{" "}
                    {formatDisplayDate(claim.submittedAt ?? claim.updatedAt)} ·{" "}
                    {CLAIM_STATUS_LABELS[claim.status]}
                    {claim.assignedExecutiveName
                      ? ` · Assigned: ${claim.assignedExecutiveName}`
                      : ""}
                  </p>
                </div>
                <Link
                  href={`/admin/claims/submitted/${claim.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                  )}
                >
                  Review
                </Link>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
