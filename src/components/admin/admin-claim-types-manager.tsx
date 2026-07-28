"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, ClipboardList } from "lucide-react";
import {
  createClaimTypeAction,
  deleteClaimTypeAction,
  updateClaimTypeAction,
} from "@/actions/claim-admin";
import { LoadingButton } from "@/components/ui/loading-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/providers/toast-provider";
import type { ClaimTypeListResult } from "@/lib/claims/claim-type-repository";
import { slugifyToInternalId } from "@/lib/utils/internal-id";
import {
  isPendingAction,
  type PendingAction,
} from "@/lib/ui/pending-action";
import { CLAIM_AMOUNT_MODE_LABELS, ClaimAmountMode } from "@/types/enums";
import type { SerializedClaimTypeConfig } from "@/types/claims";
import { cn } from "@/lib/utils";

interface AdminClaimTypesManagerProps {
  data: ClaimTypeListResult;
  canManage: boolean;
}

const EXAMPLE_CLAIM_TYPES = [
  "Medical Assistance",
  "Marriage Support",
  "Bereavement Support",
  "Parent Benefit",
  "Educational Support",
  "Emergency Relief",
  "Retirement Package",
] as const;

const emptyForm = {
  code: "",
  displayName: "",
  description: "",
  active: true,
  requiresExecutiveApproval: true,
  requiresTreasurerPayment: true,
  amountMode: ClaimAmountMode.MANUAL as string,
  fixedAmount: "",
  formulaKey: "",
  waitingPeriodDays: "180",
  benefitPercentage: "75",
  allowDrafts: true,
  maxDocuments: "10",
  allowMultipleOpenClaims: true,
  sortOrder: "100",
  codeTouched: false,
};

const SETTING_SWITCHES = [
  {
    key: "active" as const,
    label: "Active",
    helper: "Members can apply for this claim.",
  },
  {
    key: "requiresExecutiveApproval" as const,
    label: "Requires Executive Approval",
    helper: "Every application must be approved by executives.",
  },
  {
    key: "requiresTreasurerPayment" as const,
    label: "Requires Treasurer Payment",
    helper: "Treasurer must approve payment before funds are released.",
  },
  {
    key: "allowMultipleOpenClaims" as const,
    label: "Allow Multiple Open Claims",
    helper: "Members can have more than one active application.",
  },
  {
    key: "allowDrafts" as const,
    label: "Allow Saved Applications",
    helper: "Members can save unfinished applications and finish later.",
  },
];

function ClaimStatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 gap-1.5 font-medium",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-slate-50 text-slate-600",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-slate-400",
        )}
      />
      {active ? "Active" : "Disabled"}
    </Badge>
  );
}

const fieldHelperClassName = "mt-2 text-xs leading-snug text-muted-foreground";
const fieldStackClassName = "space-y-2";

export function AdminClaimTypesManager({
  data,
  canManage,
}: AdminClaimTypesManagerProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SerializedClaimTypeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [form, setForm] = useState(emptyForm);
  const [examplesOpen, setExamplesOpen] = useState(false);

  const isSaving = isPendingAction(pendingAction, "save");
  const deletingId = pendingAction?.type === "delete" ? pendingAction.id : null;

  function fieldErrorMessage(field: string): string | null {
    const messages = fieldErrors[field];
    return messages?.[0] ?? null;
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setEditing(null);
    setShowForm(false);
    setError(null);
    setFieldErrors({});
  }

  function openCreateForm() {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowForm(true);
    setError(null);
    setFieldErrors({});
  }

  function startEdit(type: SerializedClaimTypeConfig) {
    setEditing(type);
    setShowForm(true);
    setError(null);
    setFieldErrors({});
    setForm({
      code: type.code,
      displayName: type.displayName,
      description: type.description,
      active: type.active,
      requiresExecutiveApproval: type.requiresExecutiveApproval,
      requiresTreasurerPayment: type.requiresTreasurerPayment,
      amountMode: type.amountMode,
      fixedAmount: type.fixedAmount != null ? String(type.fixedAmount) : "",
      formulaKey: type.formulaKey ?? "",
      waitingPeriodDays: String(type.waitingPeriodDays ?? 0),
      benefitPercentage: String(type.benefitPercentage ?? 0),
      allowDrafts: type.allowDrafts,
      maxDocuments: String(type.maxDocuments),
      allowMultipleOpenClaims: type.allowMultipleOpenClaims,
      sortOrder: String(type.sortOrder),
      codeTouched: true,
    });
  }

  function handleDisplayNameChange(value: string) {
    setForm((current) => ({
      ...current,
      displayName: value,
      code:
        editing || current.codeTouched
          ? current.code
          : slugifyToInternalId(value),
    }));
  }

  function handleReferenceNameChange(value: string) {
    setForm((current) => ({
      ...current,
      code: value,
      codeTouched: true,
    }));
  }

  function resolveReferenceName(): string {
    const existing = form.code.trim();
    if (existing) return existing;
    return slugifyToInternalId(form.displayName);
  }

  function buildPayload() {
    return {
      code: resolveReferenceName(),
      displayName: form.displayName,
      description: form.description,
      active: form.active,
      requiresExecutiveApproval: form.requiresExecutiveApproval,
      requiresTreasurerPayment: form.requiresTreasurerPayment,
      amountMode: form.amountMode as (typeof ClaimAmountMode)[keyof typeof ClaimAmountMode],
      fixedAmount: form.fixedAmount ? Number(form.fixedAmount) : null,
      formulaKey: form.formulaKey || null,
      waitingPeriodDays: Number(form.waitingPeriodDays),
      benefitPercentage: Number(form.benefitPercentage),
      allowDrafts: form.allowDrafts,
      maxDocuments: Number(form.maxDocuments),
      requiredDocuments: editing?.requiredDocuments ?? [],
      eligibilityChecks: editing?.eligibilityChecks ?? [],
      checklist: editing?.checklist ?? [],
      notifications: editing?.notifications ?? {},
      allowMultipleOpenClaims: form.allowMultipleOpenClaims,
      duplicateRules: editing?.duplicateRules ?? {
        mode: "none" as const,
        scope: "member_and_type" as const,
      },
      sortOrder: Number(form.sortOrder),
    };
  }

  function submitForm() {
    setPendingAction({ type: "save" });
    startTransition(async () => {
      try {
        setError(null);
        setFieldErrors({});
        const resolvedCode = resolveReferenceName();
        if (!editing && resolvedCode && resolvedCode !== form.code) {
          setForm((current) => ({ ...current, code: resolvedCode }));
        }
        const payload = {
          ...buildPayload(),
          code: resolvedCode,
        };
        const result = editing
          ? await updateClaimTypeAction(editing.id, payload)
          : await createClaimTypeAction(payload);

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

        showSuccess(editing ? "Claim type updated." : "Claim type saved.");
        resetForm();
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  function removeType(typeId: string) {
    setPendingAction({ type: "delete", id: typeId });
    startTransition(async () => {
      try {
        const result = await deleteClaimTypeAction(typeId);
        if (result.error) {
          showError(result.error);
          return;
        }
        showSuccess("Claim type removed.");
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  const showFixedAmount = form.amountMode === ClaimAmountMode.FIXED;

  return (
    <div className="space-y-6">
      {canManage && data.types.length > 0 ? (
        <div className="flex flex-wrap justify-end gap-2">
          <LoadingButton
            type="button"
            className="bg-[#166534] text-white hover:bg-[#14532d]"
            onClick={openCreateForm}
          >
            Add Claim Type
          </LoadingButton>
        </div>
      ) : null}

      {showForm && canManage ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader className="space-y-2 pb-2">
            <CardTitle className="text-xl">
              {editing ? "Update Welfare Claim" : "Configure Welfare Claim"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Define the different types of welfare benefits members can apply
              for.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className={fieldStackClassName}>
              <Label htmlFor="displayName">Claim Name</Label>
              <Input
                id="displayName"
                placeholder="Parent Benefit"
                value={form.displayName}
                disabled={isSaving}
                aria-invalid={Boolean(fieldErrorMessage("displayName"))}
                onChange={(event) =>
                  handleDisplayNameChange(event.target.value)
                }
              />
              {fieldErrorMessage("displayName") ? (
                <p className="text-sm text-rose-700">
                  {fieldErrorMessage("displayName")}
                </p>
              ) : (
                <p className={fieldHelperClassName}>
                  Example: Parent Benefit, Medical Assistance, Bereavement Support
                </p>
              )}
            </div>

            {!editing ? (
              <div className={fieldStackClassName}>
                <Label htmlFor="code">Reference Name</Label>
                <Input
                  id="code"
                  placeholder="medical_support"
                  value={form.code}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrorMessage("code"))}
                  onChange={(event) =>
                    handleReferenceNameChange(event.target.value)
                  }
                />
                {fieldErrorMessage("code") ? (
                  <p className="text-sm text-rose-700">
                    {fieldErrorMessage("code")}
                  </p>
                ) : (
                  <p className={fieldHelperClassName}>
                    Filled in automatically from the claim name. Change only if
                    needed.
                  </p>
                )}
              </div>
            ) : null}

            <div className={fieldStackClassName}>
              <Label htmlFor="description">
                Description{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
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
                placeholder="Explain when members can apply for this claim."
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
                  Explain when members can apply for this claim.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className={fieldStackClassName}>
                <Label htmlFor="amountMode">Benefit Amount Method</Label>
                <select
                  id="amountMode"
                  className="h-9 w-full rounded-lg border border-input px-2.5 text-sm"
                  value={form.amountMode}
                  disabled={isSaving}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amountMode: event.target.value,
                    }))
                  }
                >
                  {Object.entries(CLAIM_AMOUNT_MODE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={fieldStackClassName}>
                <Label htmlFor="maxDocuments">Maximum Supporting Documents</Label>
                <Input
                  id="maxDocuments"
                  type="number"
                  min="0"
                  value={form.maxDocuments}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrorMessage("maxDocuments"))}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      maxDocuments: event.target.value,
                    }))
                  }
                />
                {fieldErrorMessage("maxDocuments") ? (
                  <p className="text-sm text-rose-700">
                    {fieldErrorMessage("maxDocuments")}
                  </p>
                ) : null}
              </div>

              <div className={fieldStackClassName}>
                <Label htmlFor="waitingPeriodDays">Eligibility Waiting Period</Label>
                <Input
                  id="waitingPeriodDays"
                  type="number"
                  min="0"
                  value={form.waitingPeriodDays}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrorMessage("waitingPeriodDays"))}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      waitingPeriodDays: event.target.value,
                    }))
                  }
                />
                {fieldErrorMessage("waitingPeriodDays") ? (
                  <p className="text-sm text-rose-700">
                    {fieldErrorMessage("waitingPeriodDays")}
                  </p>
                ) : (
                  <p className={fieldHelperClassName}>
                    Number of days a member must remain active before becoming
                    eligible.
                  </p>
                )}
              </div>

              <div className={fieldStackClassName}>
                <Label htmlFor="benefitPercentage">Benefit Coverage (%)</Label>
                <Input
                  id="benefitPercentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.benefitPercentage}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrorMessage("benefitPercentage"))}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      benefitPercentage: event.target.value,
                    }))
                  }
                />
                {fieldErrorMessage("benefitPercentage") ? (
                  <p className="text-sm text-rose-700">
                    {fieldErrorMessage("benefitPercentage")}
                  </p>
                ) : (
                  <p className={fieldHelperClassName}>
                    Used only when Percentage of Contribution is selected.
                  </p>
                )}
              </div>

              {showFixedAmount ? (
                <div className={cn(fieldStackClassName, "sm:col-span-2")}>
                  <Label htmlFor="fixedAmount">Fixed Amount (GHS)</Label>
                  <Input
                    id="fixedAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.fixedAmount}
                    disabled={isSaving}
                    aria-invalid={Boolean(fieldErrorMessage("fixedAmount"))}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        fixedAmount: event.target.value,
                      }))
                    }
                  />
                  {fieldErrorMessage("fixedAmount") ? (
                    <p className="text-sm text-rose-700">
                      {fieldErrorMessage("fixedAmount")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-4 rounded-xl border border-black/[0.06] p-4">
              {SETTING_SWITCHES.map((setting) => (
                <div
                  key={setting.key}
                  className="flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{setting.label}</p>
                    <p className={fieldHelperClassName}>{setting.helper}</p>
                  </div>
                  <Switch
                    checked={Boolean(form[setting.key])}
                    disabled={isSaving}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        [setting.key]: checked,
                      }))
                    }
                  />
                </div>
              ))}
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
                {editing ? "Update Claim Type" : "Save Claim Type"}
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

      <Collapsible open={examplesOpen} onOpenChange={setExamplesOpen}>
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader className="py-4">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
              <div className="min-w-0">
                <CardTitle className="text-base">Example Claim Types</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Common welfare benefits used by the association.
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  examplesOpen && "rotate-180",
                )}
              />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <ul className="grid gap-2 sm:grid-cols-2">
                {EXAMPLE_CLAIM_TYPES.map((name) => (
                  <li
                    key={name}
                    className="rounded-lg border border-black/[0.06] px-3 py-2 text-sm"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>
            Claim Categories
            {data.total > 0 ? ` (${data.total})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.types.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-[#166534]/10 text-[#166534]">
                <ClipboardList className="size-6" aria-hidden />
              </div>
              <div className="space-y-1">
                <p className="font-medium">
                  No welfare claim categories have been created yet.
                </p>
                <p className="text-sm text-muted-foreground">
                  Add the first claim type so members can apply for welfare
                  support.
                </p>
              </div>
              {canManage ? (
                <LoadingButton
                  type="button"
                  className="bg-[#166534] text-white hover:bg-[#14532d]"
                  onClick={openCreateForm}
                >
                  Create First Claim Type
                </LoadingButton>
              ) : null}
            </div>
          ) : (
            data.types.map((type) => (
              <div
                key={type.id}
                className="flex flex-col gap-3 rounded-xl border border-black/[0.06] px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{type.displayName}</p>
                    <ClaimStatusBadge active={type.active} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {CLAIM_AMOUNT_MODE_LABELS[type.amountMode]} ·{" "}
                    {type.waitingPeriodDays ?? 0} day waiting period
                    {type.amountMode === ClaimAmountMode.FORMULA
                      ? ` · ${type.benefitPercentage ?? 0}% coverage`
                      : ""}
                  </p>
                  <p className="text-sm break-words text-muted-foreground">
                    {type.description}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "border-sky-200 text-sky-700 hover:bg-sky-50",
                      )}
                      disabled={deletingId === type.id}
                      onClick={() => startEdit(type)}
                    >
                      Edit
                    </button>
                    <LoadingButton
                      type="button"
                      size="sm"
                      loading={deletingId === type.id}
                      loadingText="Removing..."
                      className="border border-red-200 bg-white text-red-700 hover:bg-red-50"
                      onClick={() => removeType(type.id)}
                    >
                      Remove
                    </LoadingButton>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
