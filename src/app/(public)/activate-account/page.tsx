import {
  AuthCardHeader,
  AuthShell,
} from "@/components/layout/auth-shell";
import { ActivationProgress } from "@/components/activation/activation-progress";
import { ActivationForm } from "@/components/forms/activation-form";
import { createPageMetadata } from "@/components/shared/page-placeholder";

export const metadata = createPageMetadata(
  "Activate Account",
  "Verify your GIS service number and phone number to activate your account",
);

export default function ActivateAccountPage() {
  return (
    <AuthShell>
      <ActivationProgress currentStep="details" />
      <div className="mb-6">
        <AuthCardHeader
          title="Verify Your Details"
          description="Confirm your service number and registered phone number."
        />
      </div>
      <ActivationForm />
    </AuthShell>
  );
}
