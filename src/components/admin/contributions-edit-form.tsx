"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateContributionAction } from "@/actions/contributions";
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
  updateContributionSchema,
  type UpdateContributionInput,
} from "@/lib/validators/contributions";
import {
  formatContributionTypeLabel,
} from "@/lib/contributions/labels";
import {
  CONTRIBUTION_TYPE_LABELS,
  ContributionType,
} from "@/types/enums";
import type { SerializedContribution } from "@/types/contribution";

interface ContributionsEditFormProps {
  record: SerializedContribution;
}

export function ContributionsEditForm({ record }: ContributionsEditFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateContributionInput>({
    resolver: zodResolver(updateContributionSchema),
    defaultValues: {
      contributionType: record.contributionType,
      amount: record.amount,
      remarks: record.remarks ?? "",
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = form;

  function onSubmit(values: UpdateContributionInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateContributionAction(record.id, values);
      if (result?.error) setServerError(result.error);
    });
  }

  return (
    <>
      <AdminBackLink href={`/admin/contributions/${record.id}`} label="Back to contribution" />
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <FieldGroup className="gap-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Member</FieldLabel>
                  <Input value={record.memberName} disabled readOnly />
                </Field>
                <Field>
                  <FieldLabel>Service Number</FieldLabel>
                  <Input value={record.serviceNumber} disabled readOnly />
                </Field>

                <Field>
                  <FieldLabel>Month</FieldLabel>
                  <Input value={String(record.month)} disabled readOnly />
                </Field>
                <Field>
                  <FieldLabel>Year</FieldLabel>
                  <Input value={String(record.year)} disabled readOnly />
                </Field>

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
                    disabled={isPending}
                    {...register("amount", { valueAsNumber: true })}
                  />
                  <FieldError errors={[errors.amount]} />
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
                loadingText="Updating..."
              >
                Update Contribution
              </LoadingButton>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

