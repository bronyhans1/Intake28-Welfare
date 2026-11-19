import Link from "next/link";
import {
  AuthCardHeader,
  AuthShell,
} from "@/components/layout/auth-shell";
import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";
import { PasswordResetProgress } from "@/components/password-reset/password-reset-progress";
import { createPageMetadata } from "@/components/shared/page-placeholder";

export const metadata = createPageMetadata(
  "Forgot Password",
  "Reset your GIS Welfare Portal password",
);

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      footer={
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <PasswordResetProgress currentStep="details" />
      <div className="mb-6">
        <AuthCardHeader
          title="Verify Identity"
          description="Confirm your service number and registered phone number."
        />
      </div>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
