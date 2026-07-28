"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  addExecutiveCommentAction,
  approveClaimAction,
  assignClaimExecutiveAction,
  fetchClaimExecutivesAction,
  recommendClaimAction,
  rejectClaimAction,
  returnClaimForRevisionAction,
  startClaimReviewAction,
} from "@/actions/claim-admin";
import { ActivityTimeline } from "@/components/timeline";
import { CLAIM_RETURN_REASON_PRESETS } from "@/lib/claims/claim-lifecycle-audit";
import {
  canAddExecutiveComment,
  canApproveClaim,
  canAssignClaimExecutive,
  canRecommendClaim,
  canRejectClaim,
  canStartClaimReview,
  getExecutiveVisibleComments,
  isTerminalClaimStatus,
} from "@/lib/claims/claim-access";
import { claimAuditHistoryToTimelineEvents } from "@/lib/claims/claim-timeline-adapter";
import {
  CLAIM_STATUS_LABELS,
  ClaimCommentVisibility,
  ClaimStatus,
} from "@/types/enums";
import type { SerializedClaim } from "@/types/claims";
import type { ClaimExecutiveOption } from "@/lib/claims/claim-executive-review";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { buttonVariants } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import { cn } from "@/lib/utils";

interface AdminSubmittedClaimDetailProps {
  claim: SerializedClaim;
}

export function AdminSubmittedClaimDetail({
  claim,
}: AdminSubmittedClaimDetailProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [reasonPreset, setReasonPreset] = useState<string>(
    CLAIM_RETURN_REASON_PRESETS[0],
  );
  const [customReason, setCustomReason] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [commentVisibility, setCommentVisibility] = useState<string>(
    ClaimCommentVisibility.INTERNAL,
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvalDecision, setApprovalDecision] = useState<string>("recommended");
  const [reducedAmount, setReducedAmount] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [executives, setExecutives] = useState<ClaimExecutiveOption[]>([]);
  const [assignedExecutiveId, setAssignedExecutiveId] = useState(
    claim.assignedExecutiveId ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  const snapshot = claim.eligibilitySnapshot;
  const progression = claim.progressionSnapshot;
  const recommendedAmount =
    claim.recommendedAmount ?? progression?.recommendedAmount ?? null;
  const claimCeiling = claim.claimCeiling ?? progression?.claimCeiling ?? null;
  const timelineEvents = claimAuditHistoryToTimelineEvents(claim.auditHistory);
  const comments = getExecutiveVisibleComments(claim.executiveComments);
  const canReturn = claim.status === ClaimStatus.SUBMITTED;
  const readOnly = isTerminalClaimStatus(claim.status);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchClaimExecutivesAction();
      if (cancelled) return;
      if ("data" in result) {
        setExecutives(result.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function runAction(
    actionKey: string,
    action: () => Promise<{ error?: string }>,
    successMessage: string,
  ) {
    setPendingAction(actionKey);
    startTransition(async () => {
      try {
        setError(null);
        const result = await action();
        if (result.error) {
          setError(result.error);
          showError(result.error);
          return;
        }
        showSuccess(successMessage);
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  const isAction = (key: string) => pendingAction === key;
  const anyActionPending = pendingAction != null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href="/admin/claims/submitted"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Back to list
        </Link>
      </div>

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
            <p className="text-muted-foreground">Member</p>
            <p className="font-medium">
              {claim.memberName} ({claim.serviceNumber})
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Claim Type</p>
            <p className="font-medium">{claim.claimTypeDisplayName}</p>
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
            <p className="text-muted-foreground">Submission Date</p>
            <p className="font-medium">
              {formatDisplayDate(claim.submittedAt ?? claim.updatedAt)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Assigned Executive</p>
            <p className="font-medium">
              {claim.assignedExecutiveName?.trim() || "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Reviewed By</p>
            <p className="font-medium">
              {claim.reviewedByName?.trim() || "—"}
              {claim.reviewStartedAt
                ? ` · ${formatDisplayDate(claim.reviewStartedAt)}`
                : ""}
            </p>
          </div>
          {claim.recommendedByName ? (
            <div>
              <p className="text-muted-foreground">Recommended By</p>
              <p className="font-medium">
                {claim.recommendedByName}
                {claim.recommendedAt
                  ? ` · ${formatDisplayDate(claim.recommendedAt)}`
                  : ""}
              </p>
            </div>
          ) : null}
          {claim.approvedByName ? (
            <div>
              <p className="text-muted-foreground">Approved By</p>
              <p className="font-medium">
                {claim.approvedByName}
                {claim.approvedAt
                  ? ` · ${formatDisplayDate(claim.approvedAt)}`
                  : ""}
              </p>
            </div>
          ) : null}
          {claim.rejectedByName ? (
            <div>
              <p className="text-muted-foreground">Rejected By</p>
              <p className="font-medium">
                {claim.rejectedByName}
                {claim.rejectedAt
                  ? ` · ${formatDisplayDate(claim.rejectedAt)}`
                  : ""}
              </p>
            </div>
          ) : null}
          {claim.rejectionReason ? (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Rejection Reason</p>
              <p className="whitespace-pre-wrap font-medium">
                {claim.rejectionReason}
              </p>
            </div>
          ) : null}
          {claim.returnedAt ? (
            <div>
              <p className="text-muted-foreground">Returned Date</p>
              <p className="font-medium">{formatDisplayDate(claim.returnedAt)}</p>
            </div>
          ) : null}
          {claim.returnedByName ? (
            <div>
              <p className="text-muted-foreground">Returned By</p>
              <p className="font-medium">{claim.returnedByName}</p>
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
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">Attachment</p>
            {claim.attachmentUrl ? (
              <a
                href={claim.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#166534] underline"
              >
                {claim.attachmentFileName ?? "View attachment"}
              </a>
            ) : (
              <p className="font-medium">—</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">WhatsApp Reference</p>
            <p className="whitespace-pre-wrap font-medium">
              {claim.whatsappEvidenceNote?.trim() || "—"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">Return Reason</p>
            <p className="whitespace-pre-wrap font-medium">
              {claim.returnReason?.trim() || "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Progression Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-muted-foreground">Welfare Points</p>
            <p className="font-medium">
              {progression ? progression.welfarePoints : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Benefit Percentage</p>
            <p className="font-medium">
              {progression
                ? `${progression.benefitPercentage}%`
                : snapshot
                  ? `${snapshot.benefitPercentage}%`
                  : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Membership Status</p>
            <p className="font-medium">
              {progression?.membershipStatus ?? snapshot?.memberStatus ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Maturity</p>
            <p className="font-medium">
              {progression ? (progression.isMature ? "Mature" : "Not mature") : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Claim Ceiling</p>
            <p className="font-medium">
              {claimCeiling != null ? `GHS ${claimCeiling.toFixed(2)}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Recommended Amount</p>
            <p className="font-medium">
              {recommendedAmount != null
                ? `GHS ${recommendedAmount.toFixed(2)}`
                : "—"}
            </p>
          </div>
          {claim.finalAmount != null ? (
            <div>
              <p className="text-muted-foreground">Final Approved Amount</p>
              <p className="font-medium">GHS {claim.finalAmount.toFixed(2)}</p>
            </div>
          ) : null}
          {claim.overrideReason ? (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Override Reason</p>
              <p className="whitespace-pre-wrap font-medium">{claim.overrideReason}</p>
            </div>
          ) : null}
          <div>
            <p className="text-muted-foreground">Constitution Version</p>
            <p className="font-medium">
              {snapshot?.constitutionVersion || "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      {!readOnly ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Executive Review Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Manual review only. Approval queues the claim for Finance using the
              final amount you select.
            </p>
            <div className="flex flex-wrap gap-2">
              {canStartClaimReview(claim.status) ? (
                <LoadingButton
                  type="button"
                  loading={isAction("start-review")}
                  disabled={anyActionPending && !isAction("start-review")}
                  loadingText="Starting..."
                  className="bg-[#166534] text-white hover:bg-[#14532d]"
                  onClick={() =>
                    runAction(
                      "start-review",
                      () => startClaimReviewAction({ claimId: claim.id }),
                      "Review started.",
                    )
                  }
                >
                  Start Review
                </LoadingButton>
              ) : null}
              {canRecommendClaim(claim.status) ? (
                <LoadingButton
                  type="button"
                  loading={isAction("recommend")}
                  disabled={anyActionPending && !isAction("recommend")}
                  loadingText="Recommending..."
                  variant="outline"
                  className="border-sky-200 text-sky-700 hover:bg-sky-50"
                  onClick={() =>
                    runAction(
                      "recommend",
                      () => recommendClaimAction({ claimId: claim.id }),
                      "Claim recommended.",
                    )
                  }
                >
                  Recommend Claim
                </LoadingButton>
              ) : null}
            </div>

            {canApproveClaim(claim.status) ? (
              <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <p className="text-sm font-medium text-emerald-950">
                  Approve claim
                  {recommendedAmount != null
                    ? ` · Recommended GHS ${recommendedAmount.toFixed(2)}`
                    : ""}
                  {claimCeiling != null
                    ? ` · Ceiling GHS ${claimCeiling.toFixed(2)}`
                    : ""}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="approvalDecision">Decision</Label>
                  <select
                    id="approvalDecision"
                    className="w-full rounded-lg border border-input bg-white px-2.5 py-2 text-sm"
                    value={approvalDecision}
                    disabled={anyActionPending}
                    onChange={(event) => setApprovalDecision(event.target.value)}
                  >
                    <option value="recommended">Approve recommended amount</option>
                    <option value="reduced">Reduce amount</option>
                    <option value="full_ceiling">Approve full claim ceiling</option>
                    <option value="full_ceiling_plus_bonus">
                      Approve full ceiling plus bonus
                    </option>
                  </select>
                </div>
                {approvalDecision === "reduced" ? (
                  <div className="space-y-2">
                    <Label htmlFor="reducedAmount">Reduced amount (GHS)</Label>
                    <input
                      id="reducedAmount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="w-full rounded-lg border border-input bg-white px-2.5 py-2 text-sm"
                      value={reducedAmount}
                      disabled={anyActionPending}
                      onChange={(event) => setReducedAmount(event.target.value)}
                    />
                  </div>
                ) : null}
                {approvalDecision === "full_ceiling_plus_bonus" ? (
                  <div className="space-y-2">
                    <Label htmlFor="bonusAmount">Bonus amount (GHS)</Label>
                    <input
                      id="bonusAmount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="w-full rounded-lg border border-input bg-white px-2.5 py-2 text-sm"
                      value={bonusAmount}
                      disabled={anyActionPending}
                      onChange={(event) => setBonusAmount(event.target.value)}
                    />
                  </div>
                ) : null}
                {approvalDecision !== "recommended" ? (
                  <div className="space-y-2">
                    <Label htmlFor="overrideReason">Override reason (required)</Label>
                    <textarea
                      id="overrideReason"
                      className="min-h-20 w-full rounded-lg border border-input bg-white px-2.5 py-2 text-sm"
                      value={overrideReason}
                      disabled={anyActionPending}
                      onChange={(event) => setOverrideReason(event.target.value)}
                    />
                  </div>
                ) : null}
                <LoadingButton
                  type="button"
                  loading={isAction("approve")}
                  disabled={anyActionPending && !isAction("approve")}
                  loadingText="Approving..."
                  className="bg-[#166534] text-white hover:bg-[#14532d]"
                  onClick={() =>
                    runAction(
                      "approve",
                      () =>
                        approveClaimAction({
                          claimId: claim.id,
                          decision: approvalDecision as
                            | "recommended"
                            | "reduced"
                            | "full_ceiling"
                            | "full_ceiling_plus_bonus",
                          approvedAmount:
                            approvalDecision === "reduced"
                              ? Number(reducedAmount)
                              : undefined,
                          bonusAmount:
                            approvalDecision === "full_ceiling_plus_bonus"
                              ? Number(bonusAmount)
                              : undefined,
                          overrideReason:
                            approvalDecision === "recommended"
                              ? undefined
                              : overrideReason,
                        }),
                      "Claim approved.",
                    )
                  }
                >
                  Approve Claim
                </LoadingButton>
              </div>
            ) : null}

            {canRejectClaim(claim.status) ? (
              <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                <Label htmlFor="rejectionReason">Rejection reason (required)</Label>
                <textarea
                  id="rejectionReason"
                  className="min-h-20 w-full rounded-lg border border-input px-2.5 py-2 text-sm"
                  value={rejectionReason}
                  disabled={anyActionPending}
                  onChange={(event) => setRejectionReason(event.target.value)}
                />
                <LoadingButton
                  type="button"
                  loading={isAction("reject")}
                  disabled={anyActionPending && !isAction("reject")}
                  loadingText="Rejecting..."
                  className="border border-red-200 bg-white text-red-700 hover:bg-red-50"
                  onClick={() =>
                    runAction(
                      "reject",
                      () =>
                        rejectClaimAction({
                          claimId: claim.id,
                          rejectionReason,
                        }),
                      "Claim rejected.",
                    )
                  }
                >
                  Reject Claim
                </LoadingButton>
              </div>
            ) : null}

            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          This claim is {CLAIM_STATUS_LABELS[claim.status].toLowerCase()} and is
          read-only.
        </p>
      )}

      {canAssignClaimExecutive(claim.status) ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Assign Executive</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Optional ownership indicator. The claim remains visible to all
              executives.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1 space-y-2">
                <Label htmlFor="assignedExecutive">Executive</Label>
                <select
                  id="assignedExecutive"
                  className="h-9 w-full rounded-lg border border-input px-2.5 text-sm"
                  value={assignedExecutiveId}
                      disabled={anyActionPending}
                  onChange={(event) =>
                    setAssignedExecutiveId(event.target.value)
                  }
                >
                  <option value="">Select executive…</option>
                  {executives.map((executive) => (
                    <option key={executive.id} value={executive.id}>
                      {executive.fullName} ({executive.role})
                    </option>
                  ))}
                </select>
              </div>
              <LoadingButton
                type="button"
                loading={isAction("assign")}
                disabled={
                  !assignedExecutiveId ||
                  (anyActionPending && !isAction("assign"))
                }
                loadingText="Assigning..."
                className="border border-sky-200 bg-white text-sky-700 hover:bg-sky-50"
                onClick={() =>
                  runAction(
                    "assign",
                    () =>
                      assignClaimExecutiveAction({
                        claimId: claim.id,
                        assignedExecutiveId,
                      }),
                    "Executive assigned.",
                  )
                }
              >
                Assign
              </LoadingButton>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canAddExecutiveComment(claim.status) ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Add Executive Comment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Comments cannot be edited or deleted after posting.
            </p>
            <div className="space-y-2">
              <Label htmlFor="commentBody">Comment</Label>
              <textarea
                id="commentBody"
                className="min-h-24 w-full rounded-lg border border-input px-2.5 py-2 text-sm"
                value={commentBody}
                      disabled={anyActionPending}
                onChange={(event) => setCommentBody(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commentVisibility">Visibility</Label>
              <select
                id="commentVisibility"
                className="h-9 w-full max-w-xs rounded-lg border border-input px-2.5 text-sm"
                value={commentVisibility}
                      disabled={anyActionPending}
                onChange={(event) => setCommentVisibility(event.target.value)}
              >
                <option value={ClaimCommentVisibility.INTERNAL}>
                  Internal (executives only)
                </option>
                <option value={ClaimCommentVisibility.MEMBER_VISIBLE}>
                  Member Visible
                </option>
              </select>
            </div>
            <LoadingButton
              type="button"
              loading={isAction("comment")}
              disabled={anyActionPending && !isAction("comment")}
              loadingText="Posting..."
              className="bg-[#166534] text-white hover:bg-[#14532d]"
              onClick={() =>
                runAction("comment", async () => {
                  const result = await addExecutiveCommentAction({
                    claimId: claim.id,
                    body: commentBody,
                    visibility: commentVisibility as
                      | typeof ClaimCommentVisibility.INTERNAL
                      | typeof ClaimCommentVisibility.MEMBER_VISIBLE,
                  });
                  if (!result.error) setCommentBody("");
                  return result;
                }, "Comment added.")
              }
            >
              Add Comment
            </LoadingButton>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Executive Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-xl border border-black/[0.06] px-4 py-3 text-sm"
              >
                <p className="whitespace-pre-wrap font-medium">{comment.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {comment.authorName} · {comment.authorRole} ·{" "}
                  {formatDisplayDate(comment.createdAt)} ·{" "}
                  {comment.visibility === ClaimCommentVisibility.MEMBER_VISIBLE
                    ? "Member Visible"
                    : "Internal"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {canReturn ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Return for Revision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send this claim back to the member for updates.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reasonPreset">Reason</Label>
              <select
                id="reasonPreset"
                className="h-9 w-full rounded-lg border border-input px-2.5 text-sm"
                value={reasonPreset}
                      disabled={anyActionPending}
                onChange={(event) => setReasonPreset(event.target.value)}
              >
                {CLAIM_RETURN_REASON_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customReason">
                {reasonPreset === "Other"
                  ? "Custom reason (required)"
                  : "Additional notes (optional)"}
              </Label>
              <textarea
                id="customReason"
                className="min-h-24 w-full rounded-lg border border-input px-2.5 py-2 text-sm"
                value={customReason}
                      disabled={anyActionPending}
                onChange={(event) => setCustomReason(event.target.value)}
              />
            </div>
            <LoadingButton
              type="button"
              loading={isAction("return")}
              disabled={anyActionPending && !isAction("return")}
              loadingText="Returning..."
              className="border border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
              onClick={() =>
                runAction(
                  "return",
                  () =>
                    returnClaimForRevisionAction({
                      claimId: claim.id,
                      reasonPreset:
                        reasonPreset as (typeof CLAIM_RETURN_REASON_PRESETS)[number],
                      customReason: customReason || null,
                    }),
                  "Claim returned for revision.",
                )
              }
            >
              Return for Revision
            </LoadingButton>
          </CardContent>
        </Card>
      ) : null}

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
