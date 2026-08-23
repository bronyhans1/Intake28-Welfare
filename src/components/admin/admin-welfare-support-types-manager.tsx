"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HandHeart } from "lucide-react";
import {
  createWelfareSupportTypeAction,
  updateWelfareSupportTypeAction,
} from "@/actions/welfare-support-types";
import { LoadingButton } from "@/components/ui/loading-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/providers/toast-provider";
import type { WelfareSupportTypeListResult } from "@/lib/welfare-support-types/repository";
import { slugifyToInternalId } from "@/lib/utils/internal-id";
import {
  isPendingAction,
  type PendingAction,
} from "@/lib/ui/pending-action";
import type { SerializedWelfareSupportTypeConfig } from "@/types/welfare-support-type";
import { cn } from "@/lib/utils";

interface AdminWelfareSupportTypesManagerProps {
  data: WelfareSupportTypeListResult;
  canManage: boolean;
}

const emptyForm = {
  code: "",
  displayName: "",
  description: "",
  active: true,
  sortOrder: "100",
  codeTouched: false,
};

function StatusBadge({ active }: { active: boolean }) {
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
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

export function AdminWelfareSupportTypesManager({
  data,
  canManage,
}: AdminWelfareSupportTypesManagerProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SerializedWelfareSupportTypeConfig | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [form, setForm] = useState(emptyForm);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(
    null,
  );

  const isSaving = isPendingAction(pendingAction, "save");
  const togglingId =
    pendingAction?.type === "delete" ? pendingAction.id : null;

  function fieldErrorMessage(field: string): string | null {
    return fieldErrors[field]?.[0] ?? null;
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

  function startEdit(type: SerializedWelfareSupportTypeConfig) {
    setEditing(type);
    setShowForm(true);
    setError(null);
    setFieldErrors({});
    setForm({
      code: type.code,
      displayName: type.displayName,
      description: type.description,
      active: type.active,
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

  function resolveCode(): string {
    const existing = form.code.trim();
    if (existing) return existing;
    return slugifyToInternalId(form.displayName);
  }

  function submitForm() {
    setPendingAction({ type: "save" });
    startTransition(async () => {
      try {
        setError(null);
        setFieldErrors({});
        const code = resolveCode();
        const payload = {
          code,
          displayName: form.displayName,
          description: form.description,
          active: form.active,
          sortOrder: Number(form.sortOrder) || 100,
        };

        const result = editing
          ? await updateWelfareSupportTypeAction(editing.id, payload)
          : await createWelfareSupportTypeAction(payload);

        if (result.error) {
          const nextFieldErrors = result.fieldErrors ?? {};
          const hasVisibleFieldErrors = Object.values(nextFieldErrors).some(
            (messages) => Boolean(messages?.length),
          );
          if (hasVisibleFieldErrors) {
            setFieldErrors(nextFieldErrors);
            setError("Please correct the highlighted fields.");
            showError("Please correct the highlighted fields.");
          } else {
            setError(result.error);
            showError(result.error);
          }
          return;
        }

        showSuccess(
          editing
            ? "Support type updated."
            : "Support type created.",
        );
        resetForm();
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  function toggleActive(type: SerializedWelfareSupportTypeConfig) {
    if (type.active && confirmDeactivateId !== type.id) {
      setConfirmDeactivateId(type.id);
      return;
    }
    setConfirmDeactivateId(null);
    setPendingAction({ type: "delete", id: type.id });
    startTransition(async () => {
      try {
        const result = await updateWelfareSupportTypeAction(type.id, {
          displayName: type.displayName,
          description: type.description,
          active: !type.active,
          sortOrder: type.sortOrder,
        });
        if (result.error) {
          showError(result.error);
          return;
        }
        showSuccess(
          type.active
            ? "Support type deactivated."
            : "Support type activated.",
        );
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Configure the support types available when recording standalone welfare
          assistance. Codes are stable and used on historical records.
        </p>
        {canManage ? (
          <button
            type="button"
            className={cn(
              buttonVariants({ className: "bg-[#166534] text-white hover:bg-[#14532d]" }),
            )}
            onClick={openCreateForm}
          >
            Add Support Type
          </button>
        ) : null}
      </div>

      {showForm && canManage ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>
              {editing ? "Edit Support Type" : "New Support Type"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={form.displayName}
                  onChange={(event) =>
                    handleDisplayNameChange(event.target.value)
                  }
                  placeholder="e.g. Funeral Support"
                  disabled={isSaving}
                />
                {fieldErrorMessage("displayName") ? (
                  <p className="text-sm text-rose-700">
                    {fieldErrorMessage("displayName")}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      code: event.target.value,
                      codeTouched: true,
                    }))
                  }
                  placeholder="e.g. funeral"
                  disabled={isSaving || Boolean(editing)}
                  readOnly={Boolean(editing)}
                />
                <p className="text-xs text-muted-foreground">
                  {editing
                    ? "Code is permanent once created."
                    : "Lowercase letters, numbers, and underscores only."}
                </p>
                {fieldErrorMessage("code") ? (
                  <p className="text-sm text-rose-700">
                    {fieldErrorMessage("code")}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sortOrder: event.target.value,
                    }))
                  }
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="min-h-20 w-full rounded-lg border border-input px-2.5 py-2 text-sm"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  disabled={isSaving}
                />
              </div>

              <div className="flex items-center gap-3 sm:col-span-2">
                <Switch
                  checked={form.active}
                  onCheckedChange={(active) =>
                    setForm((current) => ({ ...current, active }))
                  }
                  disabled={isSaving}
                />
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">
                    Active types appear in the Record Welfare Support dropdown.
                  </p>
                </div>
              </div>
            </div>

            {error ? <p className="text-sm text-rose-700">{error}</p> : null}

            <div className="flex flex-wrap gap-2">
              <LoadingButton
                type="button"
                loading={isSaving}
                loadingText="Saving..."
                className="bg-[#166534] text-white hover:bg-[#14532d]"
                onClick={submitForm}
              >
                {editing ? "Save Changes" : "Create Type"}
              </LoadingButton>
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline" }))}
                onClick={resetForm}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HandHeart className="size-4 text-muted-foreground" />
            Support Types ({data.total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.types.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
              <p className="text-sm font-medium text-slate-800">
                No support types yet
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Seed the default types or create a new support type to get
                started.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.types.map((type) => (
                <div
                  key={type.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">
                        {type.displayName}
                      </p>
                      <StatusBadge active={type.active} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Code: <span className="font-mono text-xs">{type.code}</span>
                      {" · "}
                      Sort: {type.sortOrder}
                    </p>
                    {type.description ? (
                      <p className="text-sm text-muted-foreground">
                        {type.description}
                      </p>
                    ) : null}
                    {confirmDeactivateId === type.id ? (
                      <p className="text-sm text-amber-800">
                        Deactivate this type? Historical records keep this code
                        and remain readable. Click Deactivate again to confirm.
                      </p>
                    ) : null}
                  </div>
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        onClick={() => startEdit(type)}
                        disabled={Boolean(togglingId) || isSaving}
                      >
                        Edit
                      </button>
                      <LoadingButton
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={togglingId === type.id}
                        loadingText={type.active ? "Deactivating..." : "Activating..."}
                        onClick={() => toggleActive(type)}
                        disabled={isSaving}
                      >
                        {type.active ? "Deactivate" : "Activate"}
                      </LoadingButton>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
