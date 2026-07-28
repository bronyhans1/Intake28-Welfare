"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  createWelfareSupportAction,
  updateWelfareSupportAction,
} from "@/actions/welfare-support";
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
  updateWelfareSupportSchema,
  type CreateWelfareSupportInput,
  type UpdateWelfareSupportInput,
} from "@/lib/validators/welfare-support";
import { WELFARE_SUPPORT_TYPE_LABELS, WelfareSupportType } from "@/types/enums";
import type { SerializedWelfareSupport } from "@/types/welfare-support";

interface EditWelfareSupportFormProps {
  record: SerializedWelfareSupport;
}

export function EditWelfareSupportForm({ record }: EditWelfareSupportFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateWelfareSupportInput>({
    resolver: zodResolver(updateWelfareSupportSchema),
    defaultValues: {
      supportType: record.supportType,
      amount: record.amount,
      description: record.description,
    },
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = form;

  function onSubmit(values: UpdateWelfareSupportInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateWelfareSupportAction(record.id, values);
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
                <Field>
                  <FieldLabel>Member</FieldLabel>
                  <Input value={record.memberName} disabled readOnly />
                </Field>

                <Field>
                  <FieldLabel>Service Number</FieldLabel>
                  <Input value={record.serviceNumber} disabled readOnly />
                </Field>

                <Field data-invalid={!!errors.supportType}>
                  <FieldLabel>Support Type</FieldLabel>
                  <Select
                    value={watch("supportType")}
                    onValueChange={(value: string | null) => {
                      if (value)
                        setValue("supportType", value as WelfareSupportType, {
                          shouldValidate: true,
                        });
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

              <Field data-invalid={!!errors.description}>
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
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
