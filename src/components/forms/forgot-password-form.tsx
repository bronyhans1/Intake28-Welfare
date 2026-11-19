"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { submitPasswordResetRequest } from "@/actions/password-reset";
import { ServiceNumberInput } from "@/components/forms/service-number-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  activationRequestSchema,
  type ActivationRequestInput,
} from "@/lib/validators/activation";

const ONBOARDING_ITEMS = [
  "Use the phone number registered with GIS Intake 28",
  "Enter only the numeric portion of the service number",
  "A verification code will be sent if your details match our records",
];

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<ActivationRequestInput>({
    resolver: zodResolver(activationRequestSchema),
    defaultValues: {
      serviceNumberSuffix: "",
      phoneNumber: "",
    },
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = form;

  const serviceNumberInvalid = !!errors.serviceNumberSuffix;
  const phoneInvalid = !!errors.phoneNumber;

  function onSubmit(values: ActivationRequestInput) {
    setServerError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await submitPasswordResetRequest(values);

      if (result.error) {
        setServerError(result.error);
      }

      if (result.message) {
        setSuccessMessage(result.message);
      }

      if (result.fieldErrors?.serviceNumberSuffix) {
        setError("serviceNumberSuffix", {
          message: result.fieldErrors.serviceNumberSuffix[0],
        });
      }

      if (result.fieldErrors?.phoneNumber) {
        setError("phoneNumber", {
          message: result.fieldErrors.phoneNumber[0],
        });
      }
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Forgot Password</CardTitle>
        <CardDescription>
          Enter your GIS service number and registered phone number to receive
          a reset code.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="rounded-lg border border-[#166534]/15 bg-[#166534]/5 px-4 py-3">
          <ul className="space-y-2">
            {ONBOARDING_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-[#166534]"
                  aria-hidden
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={serviceNumberInvalid ? true : undefined}>
              <FieldLabel htmlFor="serviceNumberSuffix">Service Number</FieldLabel>
              <ServiceNumberInput
                id="serviceNumberSuffix"
                invalid={serviceNumberInvalid ? true : undefined}
                disabled={isPending}
                {...register("serviceNumberSuffix")}
              />
              <FieldDescription>
                Enter the numeric portion only. Example: 13984 becomes IS/13984.
              </FieldDescription>
              <FieldError errors={[errors.serviceNumberSuffix]} />
            </Field>

            <Field data-invalid={phoneInvalid ? true : undefined}>
              <FieldLabel htmlFor="phoneNumber">Phone Number</FieldLabel>
              <Input
                id="phoneNumber"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="024XXXXXXX"
                aria-invalid={phoneInvalid ? true : undefined}
                disabled={isPending}
                {...register("phoneNumber")}
              />
              <FieldDescription>
                Use the phone number registered with GIS Intake 28.
              </FieldDescription>
              <FieldError errors={[errors.phoneNumber]} />
            </Field>

            {successMessage ? (
              <div
                role="status"
                className="rounded-lg border border-[#166534]/30 bg-[#166534]/5 px-3 py-2 text-sm text-foreground"
              >
                {successMessage}
              </div>
            ) : null}

            {serverError ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {serverError}
              </div>
            ) : null}

            <Button type="submit" className="w-full" size="lg" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Sending…
                </>
              ) : (
                "Send Reset Code"
              )}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
