"use client";

import { useState, useTransition } from "react";
import {
  requestPhoneVerificationAction,
  resendPhoneVerificationAction,
  verifyPhoneVerificationAction,
} from "@/actions/phone-verification";
import { OtpInput } from "@/components/forms/otp-input";
import { useToast } from "@/components/providers/toast-provider";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { phoneChangeRequestSchema } from "@/lib/validators/phone-verification";

interface PhoneVerificationPanelProps {
  currentPhone: string;
  onVerified?: (newPhone: string) => void;
}

function DevelopmentOtpBanner({ code }: { code: string }) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
    >
      <p className="font-semibold">Development Mode — Test OTP</p>
      <p className="mt-0.5 font-mono text-base tracking-widest">{code}</p>
    </div>
  );
}

export function PhoneVerificationPanel({
  currentPhone,
  onVerified,
}: PhoneVerificationPanelProps) {
  const [newPhone, setNewPhone] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isResending, startResendTransition] = useTransition();
  const { showSuccess, showError } = useToast();

  function handleRequestCode() {
    setServerError(null);
    setStatusMessage(null);

    const parsed = phoneChangeRequestSchema.safeParse({ newPhone });
    if (!parsed.success) {
      setServerError(
        parsed.error.flatten().fieldErrors.newPhone?.[0] ??
          "Enter a valid phone number.",
      );
      return;
    }

    startTransition(async () => {
      const result = await requestPhoneVerificationAction({
        newPhone: parsed.data.newPhone,
      });

      if (result.error) {
        setServerError(result.error);
        showError(result.error);
        return;
      }

      setVerificationId(result.verificationId ?? null);
      setDevOtp(result.devOtp ?? null);
      setStatusMessage(result.message ?? "Verification code sent.");
      setOtp("");
    });
  }

  function handleResend() {
    if (!verificationId) return;

    setServerError(null);
    startResendTransition(async () => {
      const result = await resendPhoneVerificationAction({ verificationId });
      if (result.error) {
        setServerError(result.error);
        return;
      }
      setDevOtp(result.devOtp ?? null);
      setStatusMessage(result.message ?? "Verification code resent.");
      setOtp("");
    });
  }

  function handleVerify() {
    if (!verificationId) return;

    setServerError(null);
    startTransition(async () => {
      const result = await verifyPhoneVerificationAction({ verificationId, otp });
      if (result.error) {
        setServerError(result.error);
        showError(result.error);
        return;
      }

      setStatusMessage(result.message ?? "Phone number updated.");
      showSuccess("Phone number verified successfully");
      setVerificationId(null);
      setDevOtp(null);
      setOtp("");
      setNewPhone("");
      if (result.newPhone) {
        onVerified?.(result.newPhone);
      }
    });
  }

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel>Current Phone Number</FieldLabel>
        <Input value={currentPhone} disabled readOnly />
      </Field>

      {!verificationId ? (
        <>
          <Field>
            <FieldLabel htmlFor="newPhone">New Phone Number</FieldLabel>
            <Input
              id="newPhone"
              type="tel"
              placeholder="024XXXXXXX"
              value={newPhone}
              onChange={(event) => setNewPhone(event.target.value)}
              disabled={isPending}
            />
            <FieldDescription>
              A verification code will be sent to your new number before the change is applied.
            </FieldDescription>
            <FieldError errors={serverError ? [{ message: serverError }] : []} />
          </Field>

          <LoadingButton
            type="button"
            variant="outline"
            onClick={handleRequestCode}
            loading={isPending}
            loadingText="Sending OTP…"
            disabled={!newPhone.trim()}
          >
            Send Verification Code
          </LoadingButton>
        </>
      ) : (
        <div className="space-y-4 rounded-xl border border-black/[0.08] bg-muted/20 p-4">
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to <strong>{newPhone}</strong>
          </p>

          {devOtp ? <DevelopmentOtpBanner code={devOtp} /> : null}

          {statusMessage ? (
            <p className="text-sm text-emerald-700" role="status">
              {statusMessage}
            </p>
          ) : null}

          <Field>
            <FieldLabel>Verification Code</FieldLabel>
            <OtpInput
              value={otp}
              onChange={setOtp}
              disabled={isPending}
            />
            <FieldError errors={serverError ? [{ message: serverError }] : []} />
          </Field>

          <div className="flex flex-wrap gap-2">
            <LoadingButton
              type="button"
              className="bg-[#166534] hover:bg-[#14532d]"
              onClick={handleVerify}
              loading={isPending}
              loadingText="Verifying OTP…"
              disabled={otp.length !== 6 || isResending}
            >
              Verify & Update Phone
            </LoadingButton>

            <LoadingButton
              type="button"
              variant="outline"
              onClick={handleResend}
              loading={isResending}
              loadingText="Resending OTP…"
              disabled={isPending}
            >
              Resend Code
            </LoadingButton>

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setVerificationId(null);
                setDevOtp(null);
                setOtp("");
                setServerError(null);
                setStatusMessage(null);
              }}
              disabled={isPending || isResending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </FieldGroup>
  );
}
