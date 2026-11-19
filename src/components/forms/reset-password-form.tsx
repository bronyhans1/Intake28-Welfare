"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { submitPasswordResetPassword } from "@/actions/password-reset";
import { PasswordInput } from "@/components/forms/password-input";
import { PasswordRequirementsList } from "@/components/forms/password-requirements";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  activationPasswordSchema,
  type ActivationPasswordInput,
} from "@/lib/validators/password";

interface ResetPasswordFormProps {
  serviceNumber: string;
}

export function ResetPasswordForm({ serviceNumber }: ResetPasswordFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<ActivationPasswordInput>({
    resolver: zodResolver(activationPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = form;

  const passwordValue = watch("password") ?? "";
  const passwordInvalid = !!errors.password;
  const confirmPasswordInvalid = !!errors.confirmPassword;

  function onSubmit(values: ActivationPasswordInput) {
    setServerError(null);

    startTransition(async () => {
      const result = await submitPasswordResetPassword(values);

      if (result.error) {
        setServerError(result.error);
      }

      if (result.fieldErrors?.password) {
        setError("password", {
          message: result.fieldErrors.password[0],
        });
      }

      if (result.fieldErrors?.confirmPassword) {
        setError("confirmPassword", {
          message: result.fieldErrors.confirmPassword[0],
        });
      }
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Create New Password</CardTitle>
        <CardDescription>
          Set a new password for service number {serviceNumber}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={passwordInvalid ? true : undefined}>
              <FieldLabel htmlFor="new-password">New Password</FieldLabel>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                aria-invalid={passwordInvalid ? true : undefined}
                disabled={isPending}
                {...register("password")}
              />
              <FieldError errors={[errors.password]} />
            </Field>

            <PasswordRequirementsList password={passwordValue} />

            <Field data-invalid={confirmPasswordInvalid ? true : undefined}>
              <FieldLabel htmlFor="confirm-new-password">
                Confirm New Password
              </FieldLabel>
              <PasswordInput
                id="confirm-new-password"
                autoComplete="new-password"
                aria-invalid={confirmPasswordInvalid ? true : undefined}
                disabled={isPending}
                {...register("confirmPassword")}
              />
              <FieldError errors={[errors.confirmPassword]} />
            </Field>

            {serverError ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {serverError}
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Updating password…
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
