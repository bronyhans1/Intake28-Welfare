"use client";

import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  resendPasswordResetOtp,
  submitPasswordResetOtpVerification,
} from "@/actions/password-reset";
import { OtpInput } from "@/components/forms/otp-input";
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
import {
  otpVerificationSchema,
  type OtpVerificationInput,
} from "@/lib/validators/activation";
import { formatCooldownTimer } from "@/lib/utils/password-strength";
import { useIsMounted } from "@/hooks/use-is-mounted";
import type { PasswordResetOtpDeliveryStatus } from "@/types/password-reset";

interface PasswordResetOtpFormProps {
  serviceNumber: string;
  maskedPhone: string;
  initialStatus: PasswordResetOtpDeliveryStatus;
}

function DevelopmentModeNotice() {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
    >
      <p className="font-semibold">Development Mode</p>
      <p className="mt-0.5">OTP available in server terminal.</p>
    </div>
  );
}

export function PasswordResetOtpForm({
  serviceNumber,
  maskedPhone,
  initialStatus,
}: PasswordResetOtpFormProps) {
  const mounted = useIsMounted();
  const [serverError, setServerError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(
    initialStatus.message ?? null,
  );
  const [cooldownSeconds, setCooldownSeconds] = useState(
    initialStatus.retryAfterSeconds ?? 0,
  );
  const [isPending, startTransition] = useTransition();
  const [isResending, startResendTransition] = useTransition();

  const form = useForm<OtpVerificationInput>({
    resolver: zodResolver(otpVerificationSchema),
    defaultValues: { otp: "" },
  });

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = form;

  const otpInvalid = !!errors.otp;

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setCooldownSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  function onSubmit(values: OtpVerificationInput) {
    setServerError(null);

    startTransition(async () => {
      const result = await submitPasswordResetOtpVerification(values);

      if (result.error) {
        setServerError(result.error);
      }

      if (result.fieldErrors?.otp) {
        setError("otp", { message: result.fieldErrors.otp[0] });
      }

      if (result.retryAfterSeconds) {
        setCooldownSeconds(result.retryAfterSeconds);
      }
    });
  }

  function handleResend() {
    setServerError(null);

    startResendTransition(async () => {
      const result = await resendPasswordResetOtp();

      if (result.error) {
        setServerError(result.error);
        if (result.retryAfterSeconds) {
          setCooldownSeconds(result.retryAfterSeconds);
        }
        return;
      }

      setStatusMessage(
        result.message ??
          "A new verification code has been sent. Check the server terminal in development.",
      );
      setCooldownSeconds(60);
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Enter Verification Code</CardTitle>
        <CardDescription>
          Service number {serviceNumber} · Phone ending {maskedPhone.slice(-4)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <DevelopmentModeNotice />

        {statusMessage ? (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {statusMessage}
          </p>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={otpInvalid ? true : undefined}>
              <FieldLabel htmlFor="reset-otp-0">6-Digit Code</FieldLabel>
              <Controller
                control={control}
                name="otp"
                render={({ field }) => (
                  <OtpInput
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isPending || isResending}
                    invalid={otpInvalid ? true : undefined}
                  />
                )}
              />
              <FieldDescription>
                {process.env.NODE_ENV === "development"
                  ? "Enter the code shown in your server terminal."
                  : `Enter the code sent to ${maskedPhone}.`}
              </FieldDescription>
              <FieldError errors={[errors.otp]} />
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
              disabled={isPending || isResending}
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Verifying…
                </>
              ) : (
                "Verify Code"
              )}
            </Button>

            <div className="space-y-2 text-center">
              {mounted && cooldownSeconds > 0 ? (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Resend code in {formatCooldownTimer(cooldownSeconds)}
                </p>
              ) : null}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isPending || isResending || cooldownSeconds > 0}
                onClick={handleResend}
              >
                {isResending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Resend Code"
                )}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
