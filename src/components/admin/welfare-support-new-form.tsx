"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { createWelfareSupportAction } from "@/actions/welfare-support";
import { AdminBackLink } from "@/components/admin/admin-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createWelfareSupportSchema,
  type CreateWelfareSupportInput,
} from "@/lib/validators/welfare-support";
import { WELFARE_SUPPORT_TYPE_LABELS, WelfareSupportType } from "@/types/enums";
import type { SerializedMember } from "@/types/user";

interface MemberPickerFormProps {
  members: SerializedMember[];
}

export function MemberPickerForm({ members }: MemberPickerFormProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  const form = useForm<CreateWelfareSupportInput>({
    resolver: zodResolver(createWelfareSupportSchema),
    defaultValues: {
      memberId: "",
      memberName: "",
      serviceNumber: "",
      supportType: WelfareSupportType.OTHER,
      amount: undefined,
      description: "",
    },
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = form;

  function handleMemberChange(memberId: string | null) {
    if (!memberId) return;
    setSelectedMemberId(memberId ?? "");
    const member = members.find((m) => m.id === memberId);
    if (member) {
      setValue("memberId", member.id, { shouldValidate: false });
      setValue("memberName", member.fullName, { shouldValidate: false });
      setValue("serviceNumber", member.serviceNumber, { shouldValidate: false });
    }
  }

  function onSubmit(values: CreateWelfareSupportInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await createWelfareSupportAction(values);
      if (result?.error) setServerError(result.error);
    });
  }

  return (
    <>
      <AdminBackLink href="/admin/welfare-support" label="Back to welfare support" />
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <FieldGroup className="gap-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field data-invalid={!!errors.memberId} className="sm:col-span-2">
                  <FieldLabel>Member</FieldLabel>
                  <Select value={selectedMemberId} onValueChange={(v: string | null) => handleMemberChange(v)} disabled={isPending}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a member">
                        {selectedMember
                          ? `${selectedMember.fullName} — ${selectedMember.serviceNumber}`
                          : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.fullName} — {member.serviceNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={[errors.memberId]} />
                </Field>

                {selectedMember ? (
                  <Field>
                    <FieldLabel>Service Number</FieldLabel>
                    <Input value={selectedMember.serviceNumber} disabled readOnly />
                  </Field>
                ) : null}

                <Field data-invalid={!!errors.supportType}>
                  <FieldLabel>Support Type</FieldLabel>
                  <Select
                    value={watch("supportType")}
                    onValueChange={(value: string | null) => {
                      if (value) setValue("supportType", value as WelfareSupportType, { shouldValidate: true });
                    }}
                    disabled={isPending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select support type" />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(WELFARE_SUPPORT_TYPE_LABELS) as [WelfareSupportType, string][]
                      ).map(([type, label]) => (
                        <SelectItem key={type} value={type}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={[errors.supportType]} />
                </Field>

                <Field data-invalid={!!errors.amount}>
                  <FieldLabel htmlFor="amount">Amount (GHS)</FieldLabel>
                  <Input
                    id="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="e.g. 500"
                    disabled={isPending}
                    {...register("amount", { valueAsNumber: true })}
                  />
                  <FieldError errors={[errors.amount]} />
                </Field>
              </div>

              <Field data-invalid={!!errors.description} className="sm:col-span-2">
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Input
                  id="description"
                  placeholder="Brief description of the welfare support"
                  disabled={isPending}
                  {...register("description")}
                />
                <FieldError errors={[errors.description]} />
              </Field>

              {serverError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                >
                  {serverError}
                </div>
              ) : null}

              <Button
                type="submit"
                className="h-11 bg-[#166534] hover:bg-[#14532d]"
                disabled={isPending || !selectedMemberId}
              >
                {isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Record Welfare Support"
                )}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
