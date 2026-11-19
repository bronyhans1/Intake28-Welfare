import Link from "next/link";
import { ActivationProgress } from "@/components/activation/activation-progress";
import { ActivationPasswordForm } from "@/components/forms/activation-password-form";
import {
  AuthCardHeader,
  AuthShell,
} from "@/components/layout/auth-shell";
import { requireActivationContext } from "@/lib/activation/session";
import { createPageMetadata } from "@/components/shared/page-placeholder";

export const metadata = createPageMetadata(
  "Create Password",
  "Set your password to complete GIS account activation",
);

export default async function ActivateAccountPasswordPage() {
  const context = await requireActivationContext("password");

  return (
    <AuthShell
      footer={
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Need to re-verify?{" "}
          <Link
            href="/activate-account"
            className="font-medium text-primary hover:underline"
          >
            Start over
          </Link>
        </p>
      }
    >
      <ActivationProgress currentStep="password" />
      <div className="mb-6">
        <AuthCardHeader
          title="Create Password"
          description="Create a secure password for your welfare portal account."
        />
      </div>

      <ActivationPasswordForm serviceNumber={context.serviceNumber} />
    </AuthShell>
  );
}
