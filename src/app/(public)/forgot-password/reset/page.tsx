import Link from "next/link";
import { redirect } from "next/navigation";
import { getPasswordResetStepContext } from "@/actions/password-reset";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import {
  AuthCardHeader,
  AuthShell,
} from "@/components/layout/auth-shell";
import { PasswordResetProgress } from "@/components/password-reset/password-reset-progress";
import { requirePasswordResetContext } from "@/lib/password-reset/session";
import { createPageMetadata } from "@/components/shared/page-placeholder";

export const metadata = createPageMetadata(
  "Reset Password",
  "Create a new password for your GIS Welfare Portal account",
);

export default async function ForgotPasswordResetPage() {
  await requirePasswordResetContext("reset");
  const stepContext = await getPasswordResetStepContext();

  if (!stepContext) {
    redirect("/forgot-password");
  }

  return (
    <AuthShell
      footer={
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Need help?{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-primary hover:underline"
          >
            Start over
          </Link>
        </p>
      }
    >
      <PasswordResetProgress currentStep="reset" />
      <div className="mb-6">
        <AuthCardHeader
          title="Create New Password"
          description="Choose a strong password for your account."
        />
      </div>

      <ResetPasswordForm serviceNumber={stepContext.serviceNumber} />
    </AuthShell>
  );
}
