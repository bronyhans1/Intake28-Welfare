"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Eye, Search } from "lucide-react";
import {
  approveMembershipRequestAction,
  declineMembershipRequestAction,
} from "@/actions/membership-requests";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";
import { useToast } from "@/components/providers/toast-provider";
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
import type { MembershipRequestListResult } from "@/lib/membership-requests/repository";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/utils/format-date";
import {
  MEMBERSHIP_REQUEST_STATUS_LABELS,
  MembershipRequestStatus,
  type SerializedMembershipRequest,
} from "@/types/membership-request";

interface MembershipRequestsTableProps {
  data: MembershipRequestListResult;
  canReview: boolean;
}

const SEARCH_DEBOUNCE_MS = 400;
const FILTER_ALL = "all";

function buildQuery(
  searchParams: URLSearchParams,
  updates: Record<string, string | undefined>,
) {
  const params = new URLSearchParams(searchParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (!value) params.delete(key);
    else params.set(key, value);
  }

  if ("search" in updates || "status" in updates || "sort" in updates) {
    params.set("page", "1");
  }

  return params.toString();
}

function RequestStatusBadge({ status }: { status: string }) {
  const className = cn(
    status === MembershipRequestStatus.PENDING &&
      "bg-amber-100 text-amber-800 border-amber-200",
    status === MembershipRequestStatus.APPROVED &&
      "bg-emerald-100 text-emerald-800 border-emerald-200",
    status === MembershipRequestStatus.DECLINED &&
      "bg-red-100 text-red-800 border-red-200",
  );

  return (
    <Badge variant="outline" className={className}>
      {MEMBERSHIP_REQUEST_STATUS_LABELS[
        status as keyof typeof MEMBERSHIP_REQUEST_STATUS_LABELS
      ] ?? status}
    </Badge>
  );
}

export function MembershipRequestsTable({
  data,
  canReview,
}: MembershipRequestsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess } = useToast();
  const [isPending, startTransition] = useTransition();
  const [reviewAction, setReviewAction] = useState<"approve" | "decline" | null>(
    null,
  );

  const urlSearch = searchParams.get("search") ?? "";
  const urlStatus = searchParams.get("status") ?? FILTER_ALL;
  const urlSort = searchParams.get("sort") ?? "newest";

  const [search, setSearch] = useState(urlSearch);
  const [status, setStatus] = useState(urlStatus);
  const [sort, setSort] = useState(urlSort);

  const [selected, setSelected] = useState<SerializedMembershipRequest | null>(
    null,
  );
  const [remarks, setRemarks] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  const isApproving = reviewAction === "approve";
  const isDeclining = reviewAction === "decline";
  const isReviewing = reviewAction != null;

  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);
  useEffect(() => {
    setStatus(urlStatus);
  }, [urlStatus]);
  useEffect(() => {
    setSort(urlSort);
  }, [urlSort]);

  function updateFilters(updates: Record<string, string | undefined>) {
    startTransition(() => {
      router.push(
        `/admin/membership-requests?${buildQuery(searchParams, updates)}`,
      );
    });
  }

  useEffect(() => {
    if (search === urlSearch) return;
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.push(
          `/admin/membership-requests?${buildQuery(searchParamsRef.current, {
            search: search || undefined,
          })}`,
        );
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search, urlSearch, router]);

  function openRequest(request: SerializedMembershipRequest) {
    setSelected(request);
    setRemarks(request.reviewRemarks ?? "");
    setReviewError(null);
  }

  function closeRequest() {
    setSelected(null);
    setRemarks("");
    setReviewError(null);
  }

  function handleDialogOpenChange(open: boolean) {
    if (!open) {
      if (isReviewing) return;
      closeRequest();
    }
  }

  function runApprove() {
    if (!selected || isReviewing) return;
    setReviewError(null);
    setReviewAction("approve");
    void (async () => {
      try {
        const result = await approveMembershipRequestAction({
          requestId: selected.id,
          remarks: remarks.trim() || undefined,
        });
        if (!result.success) {
          setReviewError(result.error ?? "Failed to approve request.");
          return;
        }
        showSuccess("Membership Request approved.");
        closeRequest();
        router.refresh();
      } finally {
        setReviewAction(null);
      }
    })();
  }

  function runDecline() {
    if (!selected || isReviewing) return;
    setReviewError(null);
    if (!remarks.trim()) {
      setReviewError("A reason is required when declining a request.");
      return;
    }
    setReviewAction("decline");
    void (async () => {
      try {
        const result = await declineMembershipRequestAction({
          requestId: selected.id,
          remarks: remarks.trim(),
        });
        if (!result.success) {
          setReviewError(result.error ?? "Failed to decline request.");
          return;
        }
        showSuccess("Membership Request declined.");
        closeRequest();
        router.refresh();
      } finally {
        setReviewAction(null);
      }
    })();
  }

  const isPendingRequest =
    selected?.status === MembershipRequestStatus.PENDING;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full max-w-sm space-y-1.5">
          <Label htmlFor="membership-request-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="membership-request-search"
              className="pl-8"
              placeholder="Search name, service number, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="membership-request-status">Status</Label>
            <Select
              value={status}
              onValueChange={(value) => {
                const next = value ?? FILTER_ALL;
                setStatus(next);
                updateFilters({
                  status: next === FILTER_ALL ? undefined : next,
                });
              }}
            >
              <SelectTrigger id="membership-request-status" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>All</SelectItem>
                <SelectItem value={MembershipRequestStatus.PENDING}>
                  Pending
                </SelectItem>
                <SelectItem value={MembershipRequestStatus.APPROVED}>
                  Approved
                </SelectItem>
                <SelectItem value={MembershipRequestStatus.DECLINED}>
                  Declined
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="membership-request-sort">Sort</Label>
            <Select
              value={sort}
              onValueChange={(value) => {
                const next = value ?? "newest";
                setSort(next);
                updateFilters({ sort: next === "newest" ? undefined : next });
              }}
            >
              <SelectTrigger id="membership-request-sort" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Service Number</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.requests.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No membership requests found.
                </TableCell>
              </TableRow>
            ) : (
              data.requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">{request.fullName}</TableCell>
                  <TableCell>{request.serviceNumber}</TableCell>
                  <TableCell>{request.phoneNumber}</TableCell>
                  <TableCell>
                    <RequestStatusBadge status={request.status} />
                  </TableCell>
                  <TableCell>
                    {formatDisplayDate(request.submittedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRequest(request)}
                    >
                      <Eye className="size-3.5" />
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          Showing {data.requests.length} of {data.total} requests
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={data.page <= 1 || isPending}
            onClick={() =>
              updateFilters({ page: String(Math.max(1, data.page - 1)) })
            }
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
              updateFilters({
                page: String(Math.min(data.totalPages, data.page + 1)),
              })
            }
          >
            Next
          </Button>
        </div>
      </div>

      <AlertDialog open={!!selected} onOpenChange={handleDialogOpenChange}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Membership Request</AlertDialogTitle>
            <AlertDialogDescription>
              Review the applicant details and approve or decline.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selected ? (
            <div className="space-y-4 text-sm">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Full Name</dt>
                  <dd className="font-medium">{selected.fullName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Service Number</dt>
                  <dd className="font-medium">{selected.serviceNumber}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Telephone</dt>
                  <dd className="font-medium">{selected.phoneNumber}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <RequestStatusBadge status={selected.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Submitted</dt>
                  <dd>{formatDisplayDate(selected.submittedAt)}</dd>
                </div>
                {selected.reviewedAt ? (
                  <div>
                    <dt className="text-muted-foreground">Reviewed</dt>
                    <dd>
                      {formatDisplayDate(selected.reviewedAt)}
                      {selected.reviewedByName
                        ? ` · ${selected.reviewedByName}`
                        : ""}
                    </dd>
                  </div>
                ) : null}
                {selected.memberId ? (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Member</dt>
                    <dd>
                      <Link
                        href={`/admin/members/${selected.memberId}`}
                        className={cn(
                          buttonVariants({ variant: "link" }),
                          "h-auto p-0 text-[#166534]",
                        )}
                      >
                        View member record
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>

              <div className="space-y-1.5">
                <Label htmlFor="membership-request-remarks">Remarks</Label>
                <textarea
                  id="membership-request-remarks"
                  className="min-h-20 w-full rounded-lg border border-input bg-white px-2.5 py-2 text-sm"
                  value={remarks}
                  disabled={isReviewing || !isPendingRequest || !canReview}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder={
                    isPendingRequest
                      ? "Optional for approval. Required when declining."
                      : undefined
                  }
                />
              </div>

              {reviewError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                >
                  {reviewError}
                </div>
              ) : null}

              <AlertDialogFooter>
                <AlertDialogCancel disabled={isReviewing}>
                  Close
                </AlertDialogCancel>
                {canReview && isPendingRequest ? (
                  <>
                    <LoadingButton
                      type="button"
                      loading={isDeclining}
                      disabled={isApproving}
                      loadingText="Declining..."
                      className="border border-red-200 bg-white text-red-700 hover:bg-red-50"
                      onClick={runDecline}
                    >
                      Decline
                    </LoadingButton>
                    <LoadingButton
                      type="button"
                      loading={isApproving}
                      disabled={isDeclining}
                      loadingText="Approving..."
                      className="bg-[#166534] text-white hover:bg-[#14532d]"
                      onClick={runApprove}
                    >
                      Approve
                    </LoadingButton>
                  </>
                ) : null}
              </AlertDialogFooter>
            </div>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
