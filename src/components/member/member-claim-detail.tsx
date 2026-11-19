"use client";

import Link from "next/link";
import { ActivityTimeline } from "@/components/timeline";
import {
  canMemberEditClaimContent,
  filterAuditHistoryForMemberView,
  getMemberVisibleComments,
} from "@/lib/claims/claim-access";
import { claimAuditHistoryToTimelineEvents } from "@/lib/claims/claim-timeline-adapter";
import { formatDisplayDate } from "@/lib/utils/format-date";
import {
  CLAIM_STATUS_LABELS,
  ClaimStatus,
  PAYMENT_METHOD_LABELS,
} from "@/types/enums";
import type { SerializedClaim } from "@/types/claims";
import type { MemberVisiblePaymentSummary } from "@/types/payment";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MemberClaimDetailProps {
  claim: SerializedClaim;
  payment?: MemberVisiblePaymentSummary | null;
}

export function MemberClaimDetail({
  claim,
  payment = null,
}: MemberClaimDetailProps) {
  const memberAuditHistory = filterAuditHistoryForMemberView(
    claim.auditHistory ?? [],
  );
  const timelineEvents = claimAuditHistoryToTimelineEvents(memberAuditHistory);
  const memberComments = getMemberVisibleComments(claim.executiveComments);
  const editingAllowed = canMemberEditClaimContent(claim.status);
  const isSubmitted = claim.status === ClaimStatus.SUBMITTED;
  const needsRevision = claim.status === ClaimStatus.NEEDS_REVISION;
  const underReview =
    claim.status === ClaimStatus.UNDER_REVIEW ||
    claim.status === ClaimStatus.RECOMMENDED;
  const awaitingPayment = claim.status === ClaimStatus.AWAITING_PAYMENT;
  const paymentProcessing = claim.status === ClaimStatus.PAYMENT_PROCESSING;
  const isPaid = claim.status === ClaimStatus.PAID;
  const isRejected = claim.status === ClaimStatus.REJECTED;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <Link
          href="/portal/claims"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Back to My Claims
        </Link>
        {needsRevision ? (
          <Link
            href="/portal/claims"
            className={cn(
              buttonVariants({ variant: "default" }),
              "bg-[#166534] text-white hover:bg-[#14532d]",
            )}
          >
            Revise on My Claims
          </Link>
        ) : null}
      </div>

      {isSubmitted ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
          This claim has been submitted and is currently awaiting review by the
          Welfare Executives.
        </p>
      ) : null}

      {underReview ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-950">
          Status: {CLAIM_STATUS_LABELS[claim.status]}. Welfare Executives are
          reviewing this claim.
        </p>
      ) : null}

      {awaitingPayment ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-950">
          Status: Awaiting Payment. Your claim has been approved and is in the
          Finance queue.
        </p>
      ) : null}

      {paymentProcessing ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          Status: Payment Processing. Finance is preparing your payment.
        </p>
      ) : null}

      {isPaid ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
          Status: Paid. Your claim payment has been recorded.
        </p>
      ) : null}

      {isRejected ? (
        <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-950">
          <p className="font-semibold">This claim has been rejected.</p>
          {claim.rejectionReason ? (
            <p>
              <span className="font-medium">Reason: </span>
              {claim.rejectionReason}
            </p>
          ) : null}
        </div>
      ) : null}

      {needsRevision ? (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">
            This claim has been returned for revision.
          </p>
          {claim.returnReason ? (
            <p>
              <span className="font-medium">Reason: </span>
              {claim.returnReason}
            </p>
          ) : null}
        </div>
      ) : null}

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>{claim.claimNumber ?? claim.reference}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-muted-foreground">Claim Number</p>
            <p className="font-medium">{claim.claimNumber ?? claim.reference}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className="font-medium">{CLAIM_STATUS_LABELS[claim.status]}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Claim Type</p>
            <p className="font-medium">{claim.claimTypeDisplayName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Submission Date</p>
            <p className="font-medium">
              {claim.submittedAt
                ? formatDisplayDate(claim.submittedAt)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Incident Date</p>
            <p className="font-medium">
              {claim.incidentDate
                ? formatDisplayDate(claim.incidentDate)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Editing allowed</p>
            <p className="font-medium">{editingAllowed ? "Yes" : "No"}</p>
          </div>
          {claim.recommendedAmount != null ||
          claim.progressionSnapshot != null ? (
            <>
              <div>
                <p className="text-muted-foreground">Recommended Amount</p>
                <p className="font-medium">
                  {claim.recommendedAmount != null
                    ? `GHS ${claim.recommendedAmount.toFixed(2)}`
                    : claim.progressionSnapshot?.recommendedAmount != null
                      ? `GHS ${claim.progressionSnapshot.recommendedAmount.toFixed(2)}`
                      : "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Calculated from your membership progression. Not editable.
                </p>
              </div>
              {claim.progressionSnapshot ? (
                <>
                  <div>
                    <p className="text-muted-foreground">Welfare Points</p>
                    <p className="font-medium">
                      {claim.progressionSnapshot.welfarePoints}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Benefit Percentage</p>
                    <p className="font-medium">
                      {claim.progressionSnapshot.benefitPercentage}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Membership Status</p>
                    <p className="font-medium">
                      {claim.progressionSnapshot.membershipStatus}
                    </p>
                  </div>
                </>
              ) : null}
            </>
          ) : null}
          {claim.finalAmount != null ? (
            <div>
              <p className="text-muted-foreground">Approved Amount</p>
              <p className="font-medium">GHS {claim.finalAmount.toFixed(2)}</p>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">Title</p>
            <p className="font-medium">{claim.title}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">Description</p>
            <p className="whitespace-pre-wrap font-medium">{claim.description}</p>
          </div>
        </CardContent>
      </Card>

      {isPaid && payment ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground">Amount Paid</p>
              <p className="font-medium">GHS {payment.amount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Payment Date</p>
              <p className="font-medium">
                {payment.paidAt ? formatDisplayDate(payment.paidAt) : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Payment Method</p>
              <p className="font-medium">
                {payment.paymentMethod
                  ? PAYMENT_METHOD_LABELS[payment.paymentMethod]
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Reference Number</p>
              <p className="font-medium">{payment.reference}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Executive Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {memberComments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No member-visible comments yet.
            </p>
          ) : (
            memberComments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-xl border border-black/[0.06] px-4 py-3 text-sm"
              >
                <p className="whitespace-pre-wrap font-medium">{comment.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {comment.authorName} · {formatDisplayDate(comment.createdAt)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityTimeline events={timelineEvents} />
        </CardContent>
      </Card>
    </div>
  );
}
