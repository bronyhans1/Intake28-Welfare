"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  BookOpen,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Upload,
} from "lucide-react";
import {
  createConstitutionDraftAction,
  deleteConstitutionDraftAction,
  updateConstitutionDraftAction,
} from "@/actions/claim-admin";
import { LoadingButton } from "@/components/ui/loading-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import type { ConstitutionListResult } from "@/lib/claims/constitution-repository";
import { buildConstitutionStoragePath } from "@/lib/storage/paths";
import { storageService, validateStorageFile } from "@/lib/storage/service";
import { formatDisplayDate } from "@/lib/utils/format-date";
import {
  isPendingAction,
  type PendingAction,
} from "@/lib/ui/pending-action";
import { ConstitutionStatus } from "@/types/enums";
import type { SerializedConstitutionVersion } from "@/types/claims";
import { cn } from "@/lib/utils";

interface AdminConstitutionsManagerProps {
  data: ConstitutionListResult;
  currentConstitution: SerializedConstitutionVersion | null;
  canManage: boolean;
  nextVersionId: string;
}

const emptyForm = {
  displayName: "",
  versionNumber: "1.0",
  effectiveFrom: "",
  effectiveTo: "",
  description: "",
  notes: "",
  documentRef: "",
  supersedesId: "",
};

const CONSTITUTION_UPLOAD_CONSTRAINTS = {
  maxSizeBytes: 15 * 1024 * 1024,
  acceptedMimeTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
} as const;

const MAX_UPLOAD_LABEL = "15 MB";

function formatVersionLabel(versionNumber: string): string {
  const trimmed = versionNumber.trim();
  if (!trimmed) return "—";
  return trimmed.toLowerCase().startsWith("version")
    ? trimmed
    : `Version ${trimmed}`;
}

function constitutionStatusLabel(
  status: string,
  options?: { asCurrent?: boolean },
): string {
  if (options?.asCurrent && status === ConstitutionStatus.ACTIVE) {
    return "Current";
  }
  if (status === ConstitutionStatus.ACTIVE) return "Published";
  if (status === ConstitutionStatus.RETIRED) return "Archived";
  return "Draft";
}

function ConstitutionStatusBadge({
  status,
  asCurrent = false,
}: {
  status: string;
  asCurrent?: boolean;
}) {
  const label = constitutionStatusLabel(status, { asCurrent });
  const className =
    label === "Current" || label === "Published"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : label === "Archived"
        ? "border-slate-200 bg-slate-50 text-slate-600"
        : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <Badge variant="outline" className={cn("shrink-0 font-medium", className)}>
      {label}
    </Badge>
  );
}

const fieldHelperClassName = "mt-2 text-xs leading-snug text-muted-foreground";
const fieldStackClassName = "space-y-2";

export function AdminConstitutionsManager({
  data,
  currentConstitution,
  canManage,
  nextVersionId,
}: AdminConstitutionsManagerProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SerializedConstitutionVersion | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [publishAsActive, setPublishAsActive] = useState(true);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const isSaving = isPendingAction(pendingAction, "save");
  const deletingId = pendingAction?.type === "delete" ? pendingAction.id : null;

  function fieldErrorMessage(field: string): string | null {
    return fieldErrors[field]?.[0] ?? null;
  }

  function resetForm() {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(false);
    setError(null);
    setFieldErrors({});
    setSelectedFile(null);
    setPublishAsActive(true);
    setIsDragging(false);
    setFileInputKey((key) => key + 1);
  }

  function openCreateForm() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
    setFieldErrors({});
    setSelectedFile(null);
    setPublishAsActive(true);
  }

  function startEdit(version: SerializedConstitutionVersion) {
    setEditing(version);
    setShowForm(true);
    setError(null);
    setFieldErrors({});
    setForm({
      displayName: version.displayName,
      versionNumber: version.versionNumber,
      effectiveFrom: version.effectiveFrom,
      effectiveTo: version.effectiveTo ?? "",
      description: version.description,
      notes: version.notes ?? "",
      documentRef: version.documentRef ?? "",
      supersedesId: version.supersedesId ?? "",
    });
    setSelectedFile(null);
    setPublishAsActive(version.status !== ConstitutionStatus.ACTIVE);
  }

  function acceptFile(file: File | null | undefined) {
    if (!file) return;
    const validationError = validateStorageFile(
      file,
      CONSTITUTION_UPLOAD_CONSTRAINTS,
    );
    if (validationError) {
      setError(validationError);
      showError(validationError);
      return;
    }
    setError(null);
    setSelectedFile(file);
  }

  async function uploadSelectedFile(versionKey: string): Promise<string | null> {
    if (!selectedFile) return form.documentRef || null;

    const validationError = validateStorageFile(
      selectedFile,
      CONSTITUTION_UPLOAD_CONSTRAINTS,
    );
    if (validationError) {
      throw new Error(validationError);
    }

    const extension = selectedFile.name.includes(".")
      ? selectedFile.name.slice(selectedFile.name.lastIndexOf("."))
      : selectedFile.type === "application/pdf"
        ? ".pdf"
        : ".docx";
    const safeName = `${versionKey}${extension.toLowerCase()}`;
    const path = buildConstitutionStoragePath(safeName);
    const result = await storageService.upload(path, selectedFile, {
      contentType: selectedFile.type,
      customMetadata: {
        originalName: selectedFile.name,
        versionKey,
      },
    });
    return result.downloadUrl;
  }

  function submitForm() {
    setPendingAction({ type: "save" });
    startTransition(async () => {
      setError(null);
      setFieldErrors({});
      try {
        const versionKey = editing?.id ?? nextVersionId;
        const documentRef = await uploadSelectedFile(versionKey);
        const payload = {
          ...(editing ? {} : { id: nextVersionId }),
          displayName: form.displayName,
          versionNumber: form.versionNumber,
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo || null,
          description: form.description,
          notes: form.notes || null,
          documentRef,
          supersedesId: form.supersedesId || null,
          publishAsActive: Boolean(publishAsActive && documentRef),
        };

        const result = editing
          ? await updateConstitutionDraftAction(editing.id, payload)
          : await createConstitutionDraftAction(payload);

        if (result.error) {
          const nextFieldErrors = result.fieldErrors ?? {};
          const hasVisibleFieldErrors = Object.values(nextFieldErrors).some(
            (messages) => Boolean(messages?.length),
          );
          if (hasVisibleFieldErrors) {
            setFieldErrors(nextFieldErrors);
            setError("Please correct the highlighted fields.");
            showError("Please correct the highlighted fields.");
            const firstInvalidField = Object.keys(nextFieldErrors).find(
              (key) => nextFieldErrors[key]?.length,
            );
            if (firstInvalidField) {
              window.requestAnimationFrame(() => {
                document.getElementById(firstInvalidField)?.focus();
                document
                  .getElementById(firstInvalidField)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              });
            }
          } else {
            setError(result.error);
            showError(result.error);
          }
          return;
        }

        showSuccess(
          editing
            ? publishAsActive && documentRef
              ? "Constitution updated and made available to members."
              : "Constitution updated."
            : publishAsActive && documentRef
              ? "Constitution is now available to members."
              : "Constitution saved.",
        );
        resetForm();
        router.refresh();
      } catch (uploadError) {
        const message =
          uploadError instanceof Error
            ? uploadError.message
            : "Failed to upload the constitution document.";
        setError(message);
        showError(message);
      } finally {
        setPendingAction(null);
      }
    });
  }

  function removeVersion(versionId: string) {
    setPendingAction({ type: "delete", id: versionId });
    startTransition(async () => {
      try {
        const result = await deleteConstitutionDraftAction(versionId);
        if (result.error) {
          showError(result.error);
          return;
        }
        showSuccess("Constitution draft deleted.");
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  const hasAnyConstitution =
    Boolean(currentConstitution) || data.versions.length > 0;

  const attachedFileName =
    selectedFile?.name ||
    (form.documentRef
      ? decodeURIComponent(
          form.documentRef.split("/").pop()?.split("?")[0] || "Document attached",
        )
      : null);

  return (
    <div className="space-y-6">
      {currentConstitution ? (
        <Card className="overflow-hidden rounded-2xl border border-[#166534]/25 bg-gradient-to-br from-[#166534]/[0.07] via-white to-white shadow-sm">
          <CardHeader className="space-y-3 border-b border-[#166534]/10 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-semibold tracking-wider text-[#166534] uppercase">
                  Official Document
                </p>
                <CardTitle className="truncate text-xl sm:text-2xl">
                  {currentConstitution.displayName}
                </CardTitle>
              </div>
              <ConstitutionStatusBadge
                status={currentConstitution.status}
                asCurrent
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Version</p>
                <p className="mt-1 font-medium">
                  {formatVersionLabel(currentConstitution.versionNumber)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Effective Date</p>
                <p className="mt-1 font-medium">
                  {currentConstitution.effectiveFrom}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p className="mt-1 font-medium">
                  {formatDisplayDate(currentConstitution.updatedAt)}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {currentConstitution.documentRef ? (
                <>
                  <a
                    href={currentConstitution.documentRef}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "border-sky-200 text-sky-700 hover:bg-sky-50",
                    )}
                  >
                    <Download className="size-3.5" />
                    Download
                  </a>
                  <a
                    href={currentConstitution.documentRef}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "border-sky-200 text-sky-700 hover:bg-sky-50",
                    )}
                  >
                    <Eye className="size-3.5" />
                    View
                  </a>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No downloadable document is available yet.
                </p>
              )}
              {canManage ? (
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "border-sky-200 text-sky-700 hover:bg-sky-50",
                  )}
                  onClick={() => startEdit(currentConstitution)}
                >
                  Update
                </button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canManage && hasAnyConstitution ? (
        <div className="flex flex-wrap justify-end gap-2">
          <LoadingButton
            type="button"
            className="bg-[#166534] text-white hover:bg-[#14532d]"
            onClick={openCreateForm}
          >
            Add Constitution
          </LoadingButton>
        </div>
      ) : null}

      {showForm && canManage ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader className="space-y-2 pb-2">
            <CardTitle className="text-xl">
              {editing ? "Update Welfare Constitution" : "Manage Welfare Constitution"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Upload and manage the official constitution used by all members.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={fieldStackClassName}>
                <Label htmlFor="displayName" required>
                  Constitution Title
                </Label>
                <Input
                  id="displayName"
                  placeholder="GIS Intake 28 Welfare Constitution"
                  value={form.displayName}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrorMessage("displayName"))}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                />
                {fieldErrorMessage("displayName") ? (
                  <p className="text-sm text-rose-700">
                    {fieldErrorMessage("displayName")}
                  </p>
                ) : null}
              </div>
              <div className={fieldStackClassName}>
                <Label htmlFor="versionNumber" required>
                  Version Number
                </Label>
                <Input
                  id="versionNumber"
                  placeholder="1.0"
                  value={form.versionNumber}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrorMessage("versionNumber"))}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      versionNumber: event.target.value,
                    }))
                  }
                />
                {fieldErrorMessage("versionNumber") ? (
                  <p className="text-sm text-rose-700">
                    {fieldErrorMessage("versionNumber")}
                  </p>
                ) : (
                  <p className={fieldHelperClassName}>
                    Example: Version 1.0 or Version 2.1
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className={fieldStackClassName}>
                <Label htmlFor="effectiveFrom" required>
                  Effective Date
                </Label>
                <Input
                  id="effectiveFrom"
                  type="date"
                  value={form.effectiveFrom}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrorMessage("effectiveFrom"))}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      effectiveFrom: event.target.value,
                    }))
                  }
                />
                {fieldErrorMessage("effectiveFrom") ? (
                  <p className="text-sm text-rose-700">
                    {fieldErrorMessage("effectiveFrom")}
                  </p>
                ) : null}
              </div>
              <div className={fieldStackClassName}>
                <Label htmlFor="effectiveTo">Expiry Date (Optional)</Label>
                <Input
                  id="effectiveTo"
                  type="date"
                  value={form.effectiveTo}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrorMessage("effectiveTo"))}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      effectiveTo: event.target.value,
                    }))
                  }
                />
                {fieldErrorMessage("effectiveTo") ? (
                  <p className="text-sm text-rose-700">
                    {fieldErrorMessage("effectiveTo")}
                  </p>
                ) : null}
              </div>
            </div>

            <div className={fieldStackClassName}>
              <Label htmlFor="description" required>
                Description
              </Label>
              <textarea
                id="description"
                className={cn(
                  "min-h-24 w-full rounded-lg border border-input px-2.5 py-2 text-sm",
                  fieldErrorMessage("description") &&
                    "border-destructive ring-3 ring-destructive/20",
                )}
                value={form.description}
                disabled={isSaving}
                aria-invalid={Boolean(fieldErrorMessage("description"))}
                placeholder="Summarise what changed in this constitution version."
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
              {fieldErrorMessage("description") ? (
                <p className="text-sm text-rose-700">
                  {fieldErrorMessage("description")}
                </p>
              ) : (
                <p className={fieldHelperClassName}>
                  Summarise what changed in this constitution version.
                </p>
              )}
            </div>

            <div className={fieldStackClassName}>
              <Label htmlFor="notes">Executive Notes</Label>
              <textarea
                id="notes"
                className="min-h-20 w-full rounded-lg border border-input px-2.5 py-2 text-sm"
                value={form.notes}
                disabled={isSaving}
                placeholder="Notes visible only to executives."
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
              <p className={fieldHelperClassName}>
                Visible only to executives.
              </p>
            </div>

            <div className="mx-auto w-full max-w-2xl space-y-4">
              <label
                htmlFor="constitutionFile"
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  acceptFile(event.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-8 text-center transition-colors",
                  isDragging
                    ? "border-[#166534] bg-[#166534]/5"
                    : "border-black/[0.12] bg-muted/20 hover:border-[#166534]/40 hover:bg-[#166534]/[0.03]",
                  isSaving && "pointer-events-none opacity-60",
                )}
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-[#166534]/10 text-[#166534]">
                  <Upload className="size-5" aria-hidden />
                </div>
                <p className="mt-3 text-sm font-medium text-foreground">
                  Drag and drop the constitution here
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  or click to choose a file
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1">
                    PDF
                  </span>
                  <span className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1">
                    DOCX
                  </span>
                  <span className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1">
                    Max {MAX_UPLOAD_LABEL}
                  </span>
                </div>
                <input
                  key={fileInputKey}
                  id="constitutionFile"
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="sr-only"
                  disabled={isSaving}
                  onChange={(event) => {
                    acceptFile(event.target.files?.[0]);
                  }}
                />
              </label>

              {attachedFileName ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate font-medium">
                    {selectedFile ? selectedFile.name : attachedFileName}
                  </span>
                </div>
              ) : null}

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={publishAsActive}
                  disabled={isSaving}
                  onChange={(event) => setPublishAsActive(event.target.checked)}
                />
                <span>
                  Make this the official constitution for members when a document
                  is attached.
                </span>
              </label>
            </div>

            {error ? <p className="text-sm text-rose-700">{error}</p> : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap">
              <LoadingButton
                type="button"
                loading={isSaving}
                loadingText={editing ? "Updating..." : "Saving..."}
                className="bg-[#166534] text-white hover:bg-[#14532d]"
                onClick={submitForm}
              >
                {editing ? "Update Constitution" : "Save Constitution"}
              </LoadingButton>
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline" }))}
                disabled={isSaving}
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
          <CardTitle>
            {data.total > 0
              ? `Other Versions (${data.total})`
              : "Constitution Library"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasAnyConstitution ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-[#166534]/10 text-[#166534]">
                <BookOpen className="size-6" aria-hidden />
              </div>
              <div className="space-y-1">
                <p className="font-medium">No constitution has been published.</p>
                <p className="text-sm text-muted-foreground">
                  Upload the official welfare constitution for members to read.
                </p>
              </div>
              {canManage ? (
                <LoadingButton
                  type="button"
                  className="bg-[#166534] text-white hover:bg-[#14532d]"
                  onClick={openCreateForm}
                >
                  Create Constitution
                </LoadingButton>
              ) : null}
            </div>
          ) : data.versions.length === 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-black/[0.06] px-4 py-3">
              <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No other versions yet. The current constitution is shown above.
              </p>
            </div>
          ) : (
            data.versions.map((version) => (
              <div
                key={version.id}
                className="flex flex-col gap-3 rounded-xl border border-black/[0.06] px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{version.displayName}</p>
                    <ConstitutionStatusBadge status={version.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatVersionLabel(version.versionNumber)} · Effective{" "}
                    {version.effectiveFrom}
                    {version.effectiveTo ? ` → ${version.effectiveTo}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {version.documentRef ? (
                    <>
                      <a
                        href={version.documentRef}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "border-sky-200 text-sky-700 hover:bg-sky-50",
                        )}
                      >
                        <Download className="size-3.5" />
                        Download
                      </a>
                      <a
                        href={version.documentRef}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "border-sky-200 text-sky-700 hover:bg-sky-50",
                        )}
                      >
                        <Eye className="size-3.5" />
                        View
                      </a>
                    </>
                  ) : null}
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "border-sky-200 text-sky-700 hover:bg-sky-50",
                        )}
                        disabled={deletingId === version.id}
                        onClick={() => startEdit(version)}
                      >
                        Edit
                      </button>
                      <LoadingButton
                        type="button"
                        size="sm"
                        loading={deletingId === version.id}
                        loadingText="Deleting..."
                        className="border border-red-200 bg-white text-red-700 hover:bg-red-50"
                        onClick={() => removeVersion(version.id)}
                      >
                        Delete Draft
                      </LoadingButton>
                    </>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
