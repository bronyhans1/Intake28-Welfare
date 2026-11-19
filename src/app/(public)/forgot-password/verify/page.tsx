import Link from "next/link";
import { redirect } from "next/navigation";
import { initializePasswordResetOtp } from "@/actions/password-reset";
import { PasswordResetOtpForm } from "@/components/forms/password-reset-otp-form";
import {
  AuthCardHeader,
  AuthShell,
} from "@/components/layout/auth-shell";
import { PasswordResetProgress } from "@/components/password-reset/password-reset-progress";
import { requirePasswordResetContext } from "@/lib/password-reset/session";
import { createPageMetadata } from "@/components/shared/page-placeholder";

export const metadata = createPageMetadata(
  "Verify Reset Code",
  "OTP verification step for password reset",
);

export default async function ForgotPasswordVerifyPage() {
  const context = await requirePasswordResetContext("otp");
  const { status, maskedPhone } = await initializePasswordResetOtp();

  if (!maskedPhone) {
    redirect("/forgot-password");
  }

  return (
    <AuthShell
      footer={
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Wrong details?{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-primary hover:underline"
          >
            Start over
          </Link>
        </p>
      }
    >
      <PasswordResetProgress currentStep="otp" />
      <div className="mb-6">
        <AuthCardHeader
          title="OTP Verification"
          description="Enter the verification code sent for your registered phone number."
        />
      </div>

      <PasswordResetOtpForm
        serviceNumber={context.serviceNumber}
        maskedPhone={maskedPhone}
        initialStatus={status}
      />
    </AuthShell>
  );
}
