"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  overrideParentInformationAction,
  saveParentInformationAction,
} from "@/actions/parent-information";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";
import { useToast } from "@/components/providers/toast-provider";
import {
  formatParentStatusLabel,
  isParentInformationLocked,
} from "@/lib/parent-information/validation";
import { formatDisplayDate } from "@/lib/utils/format-date";
import {
  PARENT_INFORMATION_OVERRIDE_REASONS,
  type ParentStatus,
} from "@/types/parent-information";
import type { SerializedMember } from "@/types/user";

type Mode = "member" | "admin";

interface ParentInformationCardProps {
  member: SerializedMember;
  mode: Mode;
}

type FormState = {
  motherFullName: string;
  motherStatus: ParentStatus | "";
  fatherFullName: string;
  fatherStatus: ParentStatus | "";
  overrideReason: (typeof PARENT_INFORMATION_OVERRIDE_REASONS)[number] | "";
  overrideReasonDetail: string;
};

function buildInitialForm(member: SerializedMember): FormState {
  return {
    motherFullName: member.motherFullName ?? "",
    motherStatus: member.motherStatus ?? "",
    fatherFullName: member.fatherFullName ?? "",
    fatherStatus: member.fatherStatus ?? "",
    overrideReason: "",
    overrideReasonDetail: "",
  };
}

function StatusRadios({
  name,
  value,
  disabled,
  onChange,
}: {
  name: string;
  value: ParentStatus | "";
  disabled: boolean;
  onChange: (status: ParentStatus) => void;
}) {
  return (
    <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="Status">
      {(["alive", "deceased"] as const).map((status) => (
        <label key={status} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={name}
            value={status}
            checked={value === status}
            disabled={disabled}
            onChange={() => onChange(status)}
            className="size-4 accent-[#166534]"
          />
          {formatParentStatusLabel(status)}
        </label>
      ))}
    </div>
  );
}

export function ParentInformationCard({
  member,
  mode,
}: ParentInformationCardProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [form, setForm] = useState<FormState>(() => buildInitialForm(member));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setForm(buildInitialForm(member));
  }, [member]);

  const locked = isParentInformationLocked(member);
  const completed = Boolean(member.parentInformationCompleted);
  const lockedUntilLabel = formatDisplayDate(member.parentInformationLockedUntil);

  const readOnly = mode === "member" && locked;
  const showOverrideFields = mode === "admin";
  const canSubmit = mode === "admin" || !locked;

  const confirmCopy = useMemo(() => {
    if (mode === "admin") {
      return {
        title: "Confirm Parent Information Override",
        description:
          "You are about to modify Parent Information that has been locked.\n\nThis action will be recorded in the audit history together with your name, the date and time, the previous values, the new values, and your reason for the override.\n\nPlease ensure the information has been verified before continuing.",
        actionLabel: "Save Override",
      };
    }

    return {
      title: "Confirm Parent Information",
      description:
        "You are about to submit your Parent Information.\n\nThese details are important for welfare administration and future benefit eligibility.\n\nOnce submitted, this information will be locked for 365 days. During this period, you will not be able to edit it yourself. Only a Welfare Administrator can make changes if necessary.\n\nPlease review the information carefully before continuing.",
      actionLabel: "Confirm & Save",
    };
  }, [mode]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSaveClick() {
    setError(null);
    setFieldErrors({});

    if (mode === "member" && !completed) {
      setConfirmOpen(true);
      return;
    }

    if (mode === "admin") {
      setConfirmOpen(true);
      return;
    }

    // Member re-save while unlocked (lock expired) — save directly.
    submitForm();
  }

  function submitForm() {
    startTransition(async () => {
      setError(null);
      setFieldErrors({});

      const payload = {
        motherFullName: form.motherFullName,
        motherStatus: form.motherStatus,
        fatherFullName: form.fatherFullName,
        fatherStatus: form.fatherStatus,
      };

      const result =
        mode === "admin"
          ? await overrideParentInformationAction(member.id, {
              ...payload,
              overrideReason: form.overrideReason,
              overrideReasonDetail: form.overrideReasonDetail,
            })
          : await saveParentInformationAction(payload);

      if (result.error) {
        setError(result.error);
        if (result.fieldErrors) {
          const next: Record<string, string> = {};
          for (const [key, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.[0]) next[key] = messages[0];
          }
          setFieldErrors(next);
        }
        showError(result.error);
        setConfirmOpen(false);
        return;
      }

      setConfirmOpen(false);
      if (result.successMessage) {
        showSuccess(result.successMessage);
      }
      router.refresh();
    });
  }

  return (
    <>
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Parent Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {mode === "member" && locked ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              🔒 Parent Information is locked until {lockedUntilLabel}.
              <p className="mt-1">
                If this information requires correction, please contact the
                Welfare Administrator.
              </p>
            </div>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Mother</h3>
            <div className="space-y-2">
              <Label>Status</Label>
              {readOnly ? (
                <p className="text-sm">{formatParentStatusLabel(form.motherStatus)}</p>
              ) : (
                <StatusRadios
                  name="motherStatus"
                  value={form.motherStatus}
                  disabled={isPending}
                  onChange={(status) => updateField("motherStatus", status)}
                />
              )}
              {fieldErrors.motherStatus ? (
                <p className="text-sm text-rose-700">{fieldErrors.motherStatus}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="motherFullName">Full Name</Label>
              {readOnly ? (
                <p className="text-sm">{form.motherFullName || "—"}</p>
              ) : (
                <Input
                  id="motherFullName"
                  value={form.motherFullName}
                  disabled={isPending}
                  onChange={(event) =>
                    updateField("motherFullName", event.target.value)
                  }
                  aria-invalid={Boolean(fieldErrors.motherFullName)}
                />
              )}
              {fieldErrors.motherFullName ? (
                <p className="text-sm text-rose-700">{fieldErrors.motherFullName}</p>
              ) : null}
            </div>
          </section>

          <div className="border-t border-black/[0.08]" />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Father</h3>
            <div className="space-y-2">
              <Label>Status</Label>
              {readOnly ? (
                <p className="text-sm">{formatParentStatusLabel(form.fatherStatus)}</p>
              ) : (
                <StatusRadios
                  name="fatherStatus"
                  value={form.fatherStatus}
                  disabled={isPending}
                  onChange={(status) => updateField("fatherStatus", status)}
                />
              )}
              {fieldErrors.fatherStatus ? (
                <p className="text-sm text-rose-700">{fieldErrors.fatherStatus}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fatherFullName">Full Name</Label>
              {readOnly ? (
                <p className="text-sm">{form.fatherFullName || "—"}</p>
              ) : (
                <Input
                  id="fatherFullName"
                  value={form.fatherFullName}
                  disabled={isPending}
                  onChange={(event) =>
                    updateField("fatherFullName", event.target.value)
                  }
                  aria-invalid={Boolean(fieldErrors.fatherFullName)}
                />
              )}
              {fieldErrors.fatherFullName ? (
                <p className="text-sm text-rose-700">{fieldErrors.fatherFullName}</p>
              ) : null}
            </div>
          </section>

          {showOverrideFields ? (
            <section className="space-y-3 rounded-lg border border-black/[0.08] bg-muted/30 p-4">
              <h3 className="text-sm font-semibold">Administrator Override</h3>
              <div className="space-y-2">
                <Label htmlFor="overrideReason">Reason for Override</Label>
                <select
                  id="overrideReason"
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  value={form.overrideReason}
                  disabled={isPending}
                  onChange={(event) =>
                    updateField(
                      "overrideReason",
                      event.target
                        .value as FormState["overrideReason"],
                    )
                  }
                >
                  <option value="">Select a reason</option>
                  {PARENT_INFORMATION_OVERRIDE_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
                {fieldErrors.overrideReason ? (
                  <p className="text-sm text-rose-700">
                    {fieldErrors.overrideReason}
                  </p>
                ) : null}
              </div>
              {form.overrideReason === "Other" ? (
                <div className="space-y-2">
                  <Label htmlFor="overrideReasonDetail">Describe the reason</Label>
                  <Input
                    id="overrideReasonDetail"
                    value={form.overrideReasonDetail}
                    disabled={isPending}
                    onChange={(event) =>
                      updateField("overrideReasonDetail", event.target.value)
                    }
                    aria-invalid={Boolean(fieldErrors.overrideReasonDetail)}
                  />
                  {fieldErrors.overrideReasonDetail ? (
                    <p className="text-sm text-rose-700">
                      {fieldErrors.overrideReasonDetail}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          ) : null}

          {canSubmit ? (
            <LoadingButton
              type="button"
              loading={isPending}
              loadingText={mode === "admin" ? "Saving override…" : "Saving…"}
              onClick={handleSaveClick}
              className="bg-[#166534] text-white hover:bg-[#14532d]"
            >
              {mode === "admin"
                ? "Override Parent Information"
                : "Save Parent Information"}
            </LoadingButton>
          ) : null}

          {mode === "admin" &&
          member.parentInformationOverrides &&
          member.parentInformationOverrides.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Override History</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {[...member.parentInformationOverrides]
                  .reverse()
                  .map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-lg border border-black/[0.06] px-3 py-2"
                    >
                      <p>
                        {formatDisplayDate(entry.overriddenAt)} —{" "}
                        {entry.overriddenByName}
                      </p>
                      <p>Reason: {entry.overrideReason}</p>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmCopy.title}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {confirmCopy.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              className="bg-[#166534] text-white hover:bg-[#14532d]"
              onClick={(event) => {
                event.preventDefault();
                submitForm();
              }}
            >
              {confirmCopy.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
