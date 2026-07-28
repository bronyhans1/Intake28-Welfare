"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createContributionAction } from "@/actions/contributions";
import { AdminBackLink } from "@/components/admin/admin-page-shell";
import { LoadingButton } from "@/components/ui/loading-button";
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
  createContributionSchema,
  type CreateContributionInput,
} from "@/lib/validators/contributions";
import {
  formatContributionTypeLabel,
} from "@/lib/contributions/labels";
import {
  CONTRIBUTION_TYPE_LABELS,
  ContributionType,
} from "@/types/enums";
import type { SerializedMember } from "@/types/user";

interface ContributionsNewFormProps {
  members: SerializedMember[];
  monthlyDuesAmount: number;
}

export function ContributionsNewForm({
  members,
  monthlyDuesAmount,
}: ContributionsNewFormProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId),
    [members, selectedMemberId],
  );

  const form = useForm<CreateContributionInput>({
    resolver: zodResolver(createContributionSchema),
    defaultValues: {
      memberId: "",
      memberName: "",
      serviceNumber: "",
      contributionType: ContributionType.MONTHLY_DUES,
      amount: monthlyDuesAmount,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      remarks: "",
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const contributionType = watch("contributionType");

  useEffect(() => {
    if (contributionType === ContributionType.MONTHLY_DUES) {
      const current = watch("amount");
      if (!current || current <= 0) {
        setValue("amount", monthlyDuesAmount, { shouldValidate: true });
      }
    }
  }, [contributionType, monthlyDuesAmount, setValue, watch]);

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

  function onSubmit(values: CreateContributionInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await createContributionAction(values);
      if (result?.error) setServerError(result.error);
    });
  }

  return (
    <>
      <AdminBackLink href="/admin/contributions" label="Back to contributions" />
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <FieldGroup className="gap-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field data-invalid={!!errors.memberId} className="sm:col-span-2">
                  <FieldLabel>Member</FieldLabel>
                  <Select
                    value={selectedMemberId}
                    onValueChange={(v: string | null) => handleMemberChange(v)}
                    disabled={isPending}
                  >
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

                <Field data-invalid={!!errors.contributionType}>
                  <FieldLabel>Contribution Type</FieldLabel>
                  <Select
                    value={watch("contributionType")}
                    onValueChange={(value: string | null) => {
                      if (value) {
                        setValue("contributionType", value as ContributionType, {
                          shouldValidate: true,
                        });
                      }
                    }}
                    disabled={isPending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select contribution type">
                        {formatContributionTypeLabel(watch("contributionType"))}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(CONTRIBUTION_TYPE_LABELS) as [
                          ContributionType,
                          string,
                        ][]
                      ).map(([type, label]) => (
                        <SelectItem key={type} value={type}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={[errors.contributionType]} />
                </Field>

                <Field data-invalid={!!errors.amount}>
                  <FieldLabel htmlFor="amount">Amount (GHS)</FieldLabel>
                  <Input
                    id="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder={
                      contributionType === ContributionType.MONTHLY_DUES
                        ? `Default: ${monthlyDuesAmount}`
                        : "e.g. 50"
                    }
                    disabled={isPending}
                    {...register("amount", { valueAsNumber: true })}
                  />
                  <FieldError errors={[errors.amount]} />
                </Field>

                <Field data-invalid={!!errors.month}>
                  <FieldLabel htmlFor="month">Month</FieldLabel>
                  <Input
                    id="month"
                    type="number"
                    min="1"
                    max="12"
                    disabled={isPending}
                    {...register("month", { valueAsNumber: true })}
                  />
                  <FieldError errors={[errors.month]} />
                </Field>

                <Field data-invalid={!!errors.year}>
                  <FieldLabel htmlFor="year">Year</FieldLabel>
                  <Input
                    id="year"
                    type="number"
                    min="2020"
                    max={String(new Date().getFullYear() + 1)}
                    disabled={isPending}
                    {...register("year", { valueAsNumber: true })}
                  />
                  <FieldError errors={[errors.year]} />
                </Field>
              </div>

              <Field data-invalid={!!errors.remarks} className="sm:col-span-2">
                <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
                <Input
                  id="remarks"
                  placeholder="Optional remarks"
                  disabled={isPending}
                  {...register("remarks")}
                />
                <FieldError errors={[errors.remarks]} />
              </Field>

              {serverError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                >
                  {serverError}
                </div>
              ) : null}

              <LoadingButton
                type="submit"
                className="h-11 bg-[#166534] hover:bg-[#14532d]"
                loading={isPending}
                loadingText="Recording Contribution..."
                disabled={!selectedMemberId}
              >
                Record Contribution
              </LoadingButton>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

