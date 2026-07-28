import { ActivationProgress } from "@/components/activation/activation-progress";
import { ActivationSuccessPanel } from "@/components/activation/activation-success-panel";
import {
  AuthCardHeader,
  AuthShell,
} from "@/components/layout/auth-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";

export const metadata = createPageMetadata(
  "Account Activated",
  "Your GIS Welfare Portal account has been activated",
);

export default function ActivateAccountSuccessPage() {
  return (
    <AuthShell footer={null}>
      <ActivationProgress currentStep="password" completed />
      <div className="mb-6">
        <AuthCardHeader title="Activation Complete" />
      </div>

      <ActivationSuccessPanel />
    </AuthShell>
  );
}
