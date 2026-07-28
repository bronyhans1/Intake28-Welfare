"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  createClaimDraftAction,
  deleteClaimDraftAction,
  evaluateMyClaimEligibilityAction,
  resubmitClaimAction,
  submitClaimDraftAction,
  updateClaimDraftAction,
  updateClaimRevisionAction,
} from "@/actions/claims";
import { AutomaticEligibilityBanner } from "@/components/claims/automatic-eligibility-banner";
import { LoadingButton } from "@/components/ui/loading-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import {
  buildClaimAttachmentStoragePath,
  validateClaimAttachment,
} from "@/lib/claims/claim-attachment";
import { CLAIM_ATTACHMENT } from "@/lib/constants";
import { storageService } from "@/lib/storage/service";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { CLAIM_STATUS_LABELS, ClaimStatus } from "@/types/enums";
import type { SerializedClaim, SerializedClaimTypeConfig } from "@/types/claims";
import type { ClaimListResult } from "@/lib/claims/claim-repository";
import type { ClaimSubmissionEligibilityResult } from "@/lib/claims/claim-progression";
import { cn } from "@/lib/utils";

interface MemberClaimsDraftsProps {
  data: ClaimListResult;
  claimTypes: SerializedClaimTypeConfig[];
  memberId: string;
}

type FormState = {
  claimTypeCode: string;
  title: string;
  description: string;
  incidentDate: string;
  whatsappEvidenceNote: string;
  attachmentUrl: string | null;
  attachmentPath: string | null;
  attachmentFileName: string | null;
  attachmentContentType: string | null;
};

function emptyForm(claimTypes: SerializedClaimTypeConfig[]): FormState {
  return {
    claimTypeCode: claimTypes[0]?.code ?? "",
    title: "",
    description: "",
    incidentDate: "",
    whatsappEvidenceNote: "",
    attachmentUrl: null,
    attachmentPath: null,
    attachmentFileName: null,
    attachmentContentType: null,
  };
}

export function MemberClaimsDrafts({
  data,
  claimTypes,
  memberId,
}: MemberClaimsDraftsProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<{
    type: "save" | "submit" | "delete";
    id?: string;
  } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"draft" | "revision">("draft");
  const [returnReason, setReturnReason] = useState<string | null>(null);
  const [lockedClaimNumber, setLockedClaimNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eligibilityResult, setEligibilityResult] =
    useState<ClaimSubmissionEligibilityResult | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(claimTypes));

  const drafts = data.claims.filter((claim) => claim.status === ClaimStatus.DRAFT);
  const submitted = data.claims.filter(
    (claim) => claim.status === ClaimStatus.SUBMITTED,
  );
  const needsRevision = data.claims.filter(
    (claim) => claim.status === ClaimStatus.NEEDS_REVISION,
  );
  const inReview = data.claims.filter(
    (claim) =>
      claim.status === ClaimStatus.UNDER_REVIEW ||
      claim.status === ClaimStatus.RECOMMENDED,
  );
  const decided = data.claims.filter(
    (claim) =>
      claim.status === ClaimStatus.APPROVED ||
      claim.status === ClaimStatus.REJECTED ||
      claim.status === ClaimStatus.AWAITING_PAYMENT ||
      claim.status === ClaimStatus.PAYMENT_PROCESSING ||
      claim.status === ClaimStatus.PAID,
  );

  useEffect(() => {
    if (!showForm || !form.claimTypeCode) {
      return;
    }

    let cancelled = false;
    setEligibilityLoading(true);
    setEligibilityError(null);

    void evaluateMyClaimEligibilityAction(form.claimTypeCode).then((result) => {
      if (cancelled) return;
      setEligibilityLoading(false);
      if ("error" in result && result.error) {
        setEligibilityResult(null);
        setEligibilityError(result.error);
        return;
      }
      if ("data" in result && result.data) {
        setEligibilityResult(result.data);
        setEligibilityError(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [showForm, form.claimTypeCode, editingId]);

  function resetForm() {
    setForm(emptyForm(claimTypes));
    setEditingId(null);
    setFormMode("draft");
    setReturnReason(null);
    setLockedClaimNumber(null);
    setShowForm(false);
    setError(null);
    setEligibilityResult(null);
    setEligibilityError(null);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function startEdit(claim: SerializedClaim) {
    if (claim.status !== ClaimStatus.DRAFT) {
      showError("Submitted claims cannot be edited.");
      return;
    }
    setFormMode("draft");
    setReturnReason(null);
    setLockedClaimNumber(null);
    setEditingId(claim.id);
    setShowForm(true);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setForm({
      claimTypeCode: claim.claimTypeCode,
      title: claim.title,
      description: claim.description,
      incidentDate: claim.incidentDate ?? "",
      whatsappEvidenceNote: claim.whatsappEvidenceNote ?? "",
      attachmentUrl: claim.attachmentUrl ?? null,
      attachmentPath: claim.attachmentPath ?? null,
      attachmentFileName: claim.attachmentFileName ?? null,
      attachmentContentType: claim.attachmentContentType ?? null,
    });
  }

  function startRevision(claim: SerializedClaim) {
    setFormMode("revision");
    setReturnReason(claim.returnReason ?? null);
    setLockedClaimNumber(claim.claimNumber ?? claim.reference);
    setEditingId(claim.id);
    setShowForm(true);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setForm({
      claimTypeCode: claim.claimTypeCode,
      title: claim.title,
      description: claim.description,
      incidentDate: claim.incidentDate ?? "",
      whatsappEvidenceNote: claim.whatsappEvidenceNote ?? "",
      attachmentUrl: claim.attachmentUrl ?? null,
      attachmentPath: claim.attachmentPath ?? null,
      attachmentFileName: claim.attachmentFileName ?? null,
      attachmentContentType: claim.attachmentContentType ?? null,
    });
  }

  function buildPayload(attachmentOverride?: Partial<FormState>) {
    const merged = { ...form, ...attachmentOverride };
    return {
      claimTypeCode: merged.claimTypeCode,
      title: merged.title,
      description: merged.description,
      incidentDate: merged.incidentDate || null,
      whatsappEvidenceNote: merged.whatsappEvidenceNote || null,
      attachmentUrl: merged.attachmentUrl,
      attachmentPath: merged.attachmentPath,
      attachmentFileName: merged.attachmentFileName,
      attachmentContentType: merged.attachmentContentType,
      requestedAmount: null,
    };
  }

  async function ensureDraftSaved(): Promise<string | null> {
    if (formMode === "revision") {
      if (!editingId) return null;
      const revisionPayload = {
        title: form.title,
        description: form.description,
        incidentDate: form.incidentDate,
        whatsappEvidenceNote: form.whatsappEvidenceNote || null,
        attachmentUrl: form.attachmentUrl,
        attachmentPath: form.attachmentPath,
        attachmentFileName: form.attachmentFileName,
        attachmentContentType: form.attachmentContentType,
      };
      const result = await updateClaimRevisionAction(editingId, revisionPayload);
      if (result.error) {
        setError(result.error);
        showError(result.error);
        return null;
      }
      return editingId;
    }

    const payload = buildPayload();
    if (editingId) {
      const result = await updateClaimDraftAction(editingId, payload);
      if (result.error) {
        setError(result.error);
        showError(result.error);
        return null;
      }
      return editingId;
    }

    const result = await createClaimDraftAction(payload);
    if (result.error || !result.claimId) {
      const message = result.error ?? "Failed to save draft.";
      setError(message);
      showError(message);
      return null;
    }
    setEditingId(result.claimId);
    return result.claimId;
  }

  async function uploadPendingAttachment(claimId: string): Promise<Partial<FormState> | null> {
    if (!pendingFile) return {};

    const validationError = validateClaimAttachment(pendingFile);
    if (validationError) {
      setError(validationError);
      showError(validationError);
      return null;
    }

    const storagePath = buildClaimAttachmentStoragePath(
      memberId,
      claimId,
      pendingFile.name,
    );

    try {
      const uploaded = await storageService.upload(storagePath, pendingFile, {
        contentType: pendingFile.type,
      });
      return {
        attachmentUrl: uploaded.downloadUrl,
        attachmentPath: uploaded.storagePath,
        attachmentFileName: pendingFile.name,
        attachmentContentType: pendingFile.type,
      };
    } catch {
      const message = "Failed to upload attachment. Please try again.";
      setError(message);
      showError(message);
      return null;
    }
  }

  function saveDraft() {
    setPendingAction({ type: "save" });
    startTransition(async () => {
      try {
      setError(null);
      const claimId = await ensureDraftSaved();
      if (!claimId) return;

      if (pendingFile) {
        const attachment = await uploadPendingAttachment(claimId);
        if (!attachment) return;
        if (Object.keys(attachment).length > 0) {
          if (formMode === "revision") {
            const update = await updateClaimRevisionAction(claimId, {
              title: form.title,
              description: form.description,
              incidentDate: form.incidentDate,
              whatsappEvidenceNote: form.whatsappEvidenceNote || null,
              attachmentUrl: attachment.attachmentUrl ?? form.attachmentUrl,
              attachmentPath: attachment.attachmentPath ?? form.attachmentPath,
              attachmentFileName:
                attachment.attachmentFileName ?? form.attachmentFileName,
              attachmentContentType:
                attachment.attachmentContentType ?? form.attachmentContentType,
            });
            if (update.error) {
              setError(update.error);
              showError(update.error);
              return;
            }
          } else {
            const update = await updateClaimDraftAction(
              claimId,
              buildPayload(attachment),
            );
            if (update.error) {
              setError(update.error);
              showError(update.error);
              return;
            }
          }
          setForm((current) => ({ ...current, ...attachment }));
          setPendingFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      }

      showSuccess(formMode === "revision" ? "Revision saved." : "Draft saved.");
      resetForm();
      router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  function submitClaim() {
    setPendingAction({ type: "submit" });
    startTransition(async () => {
      try {
      setError(null);

      if (!eligibilityResult?.eligible) {
        const message =
          "You cannot submit this claim until the eligibility requirements have been met.";
        setError(message);
        showError(message);
        return;
      }

      if (!form.incidentDate.trim()) {
        const message = "Incident date is required before submitting.";
        setError(message);
        showError(message);
        return;
      }

      const claimId = await ensureDraftSaved();
      if (!claimId) return;

      if (pendingFile) {
        const attachment = await uploadPendingAttachment(claimId);
        if (!attachment) return;
        if (Object.keys(attachment).length > 0) {
          if (formMode === "revision") {
            const update = await updateClaimRevisionAction(claimId, {
              title: form.title,
              description: form.description,
              incidentDate: form.incidentDate,
              whatsappEvidenceNote: form.whatsappEvidenceNote || null,
              attachmentUrl: attachment.attachmentUrl ?? form.attachmentUrl,
              attachmentPath: attachment.attachmentPath ?? form.attachmentPath,
              attachmentFileName:
                attachment.attachmentFileName ?? form.attachmentFileName,
              attachmentContentType:
                attachment.attachmentContentType ?? form.attachmentContentType,
            });
            if (update.error) {
              setError(update.error);
              showError(update.error);
              return;
            }
          } else {
            const update = await updateClaimDraftAction(
              claimId,
              buildPayload(attachment),
            );
            if (update.error) {
              setError(update.error);
              showError(update.error);
              return;
            }
          }
        }
      }

      const result =
        formMode === "revision"
          ? await resubmitClaimAction(claimId)
          : await submitClaimDraftAction(claimId);
      if (result.error || !result.claimNumber) {
        const message = result.error ?? "Failed to submit claim.";
        setError(message);
        showError(message);
        return;
      }

      resetForm();
      router.push(
        `/portal/claims/success?claimNumber=${encodeURIComponent(result.claimNumber)}`,
      );
      router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  function removeDraft(claimId: string) {
    setPendingAction({ type: "delete", id: claimId });
    startTransition(async () => {
      try {
        const result = await deleteClaimDraftAction(claimId);
        if (result.error) {
          showError(result.error);
          return;
        }
        showSuccess("Draft deleted.");
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  const canSubmit = Boolean(eligibilityResult?.eligible) && !eligibilityLoading;
  const isSaving = pendingAction?.type === "save";
  const isSubmitting = pendingAction?.type === "submit";
  const deletingId =
    pendingAction?.type === "delete" ? pendingAction.id : null;
  const isFormBusy = isSaving || isSubmitting;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <LoadingButton
          type="button"
          className="bg-[#166534] text-white hover:bg-[#14532d]"
          disabled={claimTypes.length === 0}
          onClick={() => {
            setEditingId(null);
            setFormMode("draft");
            setReturnReason(null);
            setLockedClaimNumber(null);
            setForm(emptyForm(claimTypes));
            setPendingFile(null);
            setShowForm(true);
          }}
        >
          New Draft
        </LoadingButton>
      </div>

      {claimTypes.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          No active claim types are available yet. An administrator must create
          claim types before you can save drafts.
        </p>
      ) : null}

      {showForm ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>
              {formMode === "revision"
                ? "Revise Claim"
                : editingId
                  ? "Edit Draft"
                  : "New Claim Draft"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {formMode === "revision" ? (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">
                  This claim has been returned for revision.
                </p>
                {returnReason ? (
                  <p>
                    <span className="font-medium">Reason: </span>
                    {returnReason}
                  </p>
                ) : null}
                {lockedClaimNumber ? (
                  <p className="text-xs">
                    Claim Number {lockedClaimNumber} is permanent and cannot
                    change.
                  </p>
                ) : null}
              </div>
            ) : null}

            <AutomaticEligibilityBanner
              result={eligibilityResult}
              loading={eligibilityLoading}
              error={eligibilityError}
            />

            <div className="space-y-2">
              <Label htmlFor="claimTypeCode">Claim Type</Label>
              <select
                id="claimTypeCode"
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm disabled:opacity-60"
                value={form.claimTypeCode}
                disabled={isFormBusy || formMode === "revision"}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    claimTypeCode: event.target.value,
                  }))
                }
              >
                {claimTypes.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.displayName}
                  </option>
                ))}
              </select>
              {formMode === "revision" ? (
                <p className="text-xs text-muted-foreground">
                  Claim type cannot be changed after submission.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="incidentDate">Incident Date</Label>
              <Input
                id="incidentDate"
                type="date"
                value={form.incidentDate}
                disabled={isFormBusy}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    incidentDate: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Short Title</Label>
              <Input
                id="title"
                value={form.title}
                disabled={isFormBusy}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                className="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
                value={form.description}
                disabled={isFormBusy}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="attachment">Optional Attachment</Label>
              <Input
                id="attachment"
                ref={fileInputRef}
                type="file"
                accept={CLAIM_ATTACHMENT.ACCEPTED_MIME_TYPES.join(",")}
                disabled={isFormBusy}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (!file) {
                    setPendingFile(null);
                    return;
                  }
                  const validationError = validateClaimAttachment(file);
                  if (validationError) {
                    showError(validationError);
                    event.target.value = "";
                    setPendingFile(null);
                    return;
                  }
                  setPendingFile(file);
                }}
              />
              <p className="text-xs text-muted-foreground">
                PDF or image, max 5 MB.
                {form.attachmentFileName
                  ? ` Current: ${form.attachmentFileName}`
                  : ""}
                {pendingFile ? ` Selected: ${pendingFile.name}` : ""}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappEvidenceNote">
                Optional WhatsApp Evidence Reference
              </Label>
              <textarea
                id="whatsappEvidenceNote"
                className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
                placeholder="Evidence has been sent to the Welfare Secretary via WhatsApp."
                value={form.whatsappEvidenceNote}
                disabled={isFormBusy}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    whatsappEvidenceNote: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Note only — the system does not send WhatsApp messages.
              </p>
            </div>

            {error ? <p className="text-sm text-rose-700">{error}</p> : null}

            {!canSubmit && !eligibilityLoading ? (
              <p className="text-sm text-amber-900">
                You cannot submit this claim until the eligibility requirements
                have been met.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <LoadingButton
                type="button"
                loading={isSaving}
                loadingText="Saving..."
                className="bg-[#166534] text-white hover:bg-[#14532d]"
                onClick={saveDraft}
              >
                {formMode === "revision" ? "Save Changes" : "Save Draft"}
              </LoadingButton>
              <LoadingButton
                type="button"
                loading={isSubmitting}
                loadingText="Submitting Claim..."
                disabled={!canSubmit || isSaving}
                className="bg-[#166534] text-white hover:bg-[#14532d] disabled:opacity-50"
                onClick={submitClaim}
              >
                {formMode === "revision" ? "Resubmit Claim" : "Submit Claim"}
              </LoadingButton>
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline" }))}
                disabled={isFormBusy}
                onClick={resetForm}
              >
                Cancel
              </button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>My Drafts ({drafts.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have no claim drafts yet.
            </p>
          ) : (
            drafts.map((claim) => (
              <div
                key={claim.id}
                className="rounded-xl border border-black/[0.06] px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{claim.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {claim.reference} · {claim.claimTypeDisplayName} ·{" "}
                      {CLAIM_STATUS_LABELS[claim.status]}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Updated {formatDisplayDate(claim.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "border-sky-300 text-sky-800 hover:bg-sky-50",
                      )}
                      disabled={deletingId === claim.id}
                      onClick={() => startEdit(claim)}
                    >
                      Edit
                    </button>
                    <LoadingButton
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={deletingId === claim.id}
                      loadingText="Deleting..."
                      className="border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() => removeDraft(claim.id)}
                    >
                      Delete
                    </LoadingButton>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Needs Revision ({needsRevision.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {needsRevision.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No claims are currently returned for revision.
            </p>
          ) : (
            needsRevision.map((claim) => (
              <div
                key={claim.id}
                className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {claim.claimNumber ?? claim.reference}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {claim.title} · {claim.claimTypeDisplayName} ·{" "}
                      {CLAIM_STATUS_LABELS[claim.status]}
                    </p>
                    {claim.returnReason ? (
                      <p className="mt-2 text-sm text-amber-950">
                        Reason: {claim.returnReason}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/portal/claims/${claim.id}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                      )}
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                      )}
                      disabled={isFormBusy}
                      onClick={() => startRevision(claim)}
                    >
                      Revise
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Submitted Claims ({submitted.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {submitted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have not submitted any claims yet.
            </p>
          ) : (
            submitted.map((claim) => (
              <div
                key={claim.id}
                className="rounded-xl border border-black/[0.06] px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {claim.claimNumber ?? claim.reference}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {claim.title} · {claim.claimTypeDisplayName} ·{" "}
                      {CLAIM_STATUS_LABELS[claim.status]}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Submitted{" "}
                      {formatDisplayDate(claim.submittedAt ?? claim.updatedAt)}
                    </p>
                    <p className="mt-2 text-sm text-emerald-900">
                      This claim has been submitted and is currently awaiting
                      review by the Welfare Executives.
                    </p>
                    {claim.attachmentUrl ? (
                      <a
                        href={claim.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm text-[#166534] underline"
                      >
                        Download attachment
                        {claim.attachmentFileName
                          ? ` (${claim.attachmentFileName})`
                          : ""}
                      </a>
                    ) : null}
                  </div>
                  <Link
                    href={`/portal/claims/${claim.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                  >
                    View
                  </Link>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Under Review ({inReview.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {inReview.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No claims are currently under executive review.
            </p>
          ) : (
            inReview.map((claim) => (
              <div
                key={claim.id}
                className="rounded-xl border border-sky-200 bg-sky-50/40 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {claim.claimNumber ?? claim.reference}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {claim.title} · {claim.claimTypeDisplayName} ·{" "}
                      {CLAIM_STATUS_LABELS[claim.status]}
                    </p>
                  </div>
                  <Link
                    href={`/portal/claims/${claim.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                  >
                    View
                  </Link>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Decided Claims ({decided.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {decided.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No approved or rejected claims yet.
            </p>
          ) : (
            decided.map((claim) => (
              <div
                key={claim.id}
                className="rounded-xl border border-black/[0.06] px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {claim.claimNumber ?? claim.reference}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {claim.title} · {claim.claimTypeDisplayName} ·{" "}
                      {CLAIM_STATUS_LABELS[claim.status]}
                    </p>
                    {claim.status === ClaimStatus.REJECTED &&
                    claim.rejectionReason ? (
                      <p className="mt-2 text-sm text-rose-900">
                        Reason: {claim.rejectionReason}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/portal/claims/${claim.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                  >
                    View
                  </Link>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Need help?{" "}
        <Link href="/portal/profile" className="text-[#166534] underline">
          Complete your profile
        </Link>{" "}
        and Parent Information if eligibility checks fail.
      </p>
    </div>
  );
}
