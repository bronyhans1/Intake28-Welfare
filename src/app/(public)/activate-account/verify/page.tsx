import Link from "next/link";
import { redirect } from "next/navigation";
import { initializeActivationOtp } from "@/actions/activation-otp";
import { ActivationProgress } from "@/components/activation/activation-progress";
import { OtpVerificationForm } from "@/components/forms/otp-verification-form";
import {
  AuthCardHeader,
  AuthShell,
} from "@/components/layout/auth-shell";
import { requireActivationContext } from "@/lib/activation/session";
import { createPageMetadata } from "@/components/shared/page-placeholder";

export const metadata = createPageMetadata(
  "Verify Account",
  "OTP verification step for GIS account activation",
);

export default async function ActivateAccountVerifyPage() {
  const context = await requireActivationContext("otp");
  const { status, maskedPhone } = await initializeActivationOtp();

  if (!maskedPhone) {
    redirect("/activate-account");
  }

  return (
    <AuthShell
      footer={
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Wrong details?{" "}
          <Link
            href="/activate-account"
            className="font-medium text-primary hover:underline"
          >
            Start over
          </Link>
        </p>
      }
    >
      <ActivationProgress currentStep="otp" />
      <div className="mb-6">
        <AuthCardHeader
          title="Verify OTP"
          description="Enter the verification code sent for your registered phone number."
        />
      </div>

      <OtpVerificationForm
        serviceNumber={context.serviceNumber}
        maskedPhone={maskedPhone}
        initialStatus={status}
      />
    </AuthShell>
  );
}
