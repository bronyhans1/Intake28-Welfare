"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitMembershipRequestAction } from "@/actions/membership-requests";
import { ServiceNumberInput } from "@/components/forms/service-number-input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { MembershipRequestNextAction } from "@/lib/membership-requests/duplicates";
import {
  submitMembershipRequestSchema,
  type SubmitMembershipRequestInput,
} from "@/lib/validators/membership-request";

const inputClassName = cn(
  "h-10",
  "focus-visible:border-[#166534] focus-visible:ring-[#166534]/25",
);

const actionLinkClassName = cn(
  buttonVariants({ size: "sm" }),
  "bg-[#166534] text-white hover:bg-[#14532d]",
);

interface RequestAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestAccessDialog({
  open,
  onOpenChange,
}: RequestAccessDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [nextAction, setNextAction] =
    useState<MembershipRequestNextAction | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<SubmitMembershipRequestInput>({
    resolver: zodResolver(submitMembershipRequestSchema),
    defaultValues: {
      fullName: "",
      serviceNumberSuffix: "",
      phoneNumber: "",
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    if (!next) {
      setServerError(null);
      setNextAction(null);
      setSuccessMessage(null);
      reset();
    }
    onOpenChange(next);
  }

  function onSubmit(values: SubmitMembershipRequestInput) {
    if (isPending) return;
    setServerError(null);
    setNextAction(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await submitMembershipRequestAction(values);
      if (!result.success) {
        setServerError(result.error ?? "Failed to submit request.");
        setNextAction(result.nextAction ?? null);
        return;
      }

      setSuccessMessage(
        "Your request was submitted. An executive will review it shortly.",
      );
      reset();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Request Access</AlertDialogTitle>
          <AlertDialogDescription>
            Submit your details for executive review. If approved, you will use
            Activate Account to create your login credentials.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {successMessage ? (
          <div className="space-y-4">
            <p
              role="status"
              className="rounded-lg border border-[#166534]/25 bg-[#166534]/5 px-3 py-2.5 text-sm text-[#14532d]"
            >
              {successMessage}
            </p>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <FieldGroup className="gap-4">
              <Field data-invalid={errors.fullName ? true : undefined}>
                <FieldLabel htmlFor="requestFullName">Full Name</FieldLabel>
                <Input
                  id="requestFullName"
                  autoComplete="name"
                  placeholder="Enter your full name"
                  disabled={isPending}
                  className={inputClassName}
                  {...register("fullName")}
                />
                <FieldError errors={[errors.fullName]} />
              </Field>

              <Field data-invalid={errors.serviceNumberSuffix ? true : undefined}>
                <FieldLabel htmlFor="requestServiceNumber">
                  Service Number
                </FieldLabel>
                <ServiceNumberInput
                  id="requestServiceNumber"
                  invalid={errors.serviceNumberSuffix ? true : undefined}
                  disabled={isPending}
                  {...register("serviceNumberSuffix")}
                />
                <FieldError errors={[errors.serviceNumberSuffix]} />
              </Field>

              <Field data-invalid={errors.phoneNumber ? true : undefined}>
                <FieldLabel htmlFor="requestPhoneNumber">
                  Telephone Number
                </FieldLabel>
                <Input
                  id="requestPhoneNumber"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="024XXXXXXX"
                  disabled={isPending}
                  className={inputClassName}
                  {...register("phoneNumber")}
                />
                <FieldError errors={[errors.phoneNumber]} />
              </Field>

              {serverError ? (
                <div
                  role="alert"
                  className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                >
                  <p>{serverError}</p>
                  {nextAction === "sign_in" ? (
                    <Link href="/login" className={actionLinkClassName}>
                      Sign In
                    </Link>
                  ) : null}
                  {nextAction === "activate_account" ? (
                    <Link
                      href="/activate-account"
                      className={actionLinkClassName}
                    >
                      Activate Account
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </FieldGroup>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <LoadingButton
                type="submit"
                loading={isPending}
                loadingText="Submitting..."
                className="bg-[#166534] text-white hover:bg-[#14532d]"
              >
                Submit Request
              </LoadingButton>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
