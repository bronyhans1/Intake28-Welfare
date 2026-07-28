import {
  AuthShell,
} from "@/components/layout/auth-shell";
import { PasswordResetProgress } from "@/components/password-reset/password-reset-progress";
import { PasswordResetSuccessPanel } from "@/components/password-reset/password-reset-success-panel";
import { createPageMetadata } from "@/components/shared/page-placeholder";

export const metadata = createPageMetadata(
  "Password Reset Successful",
  "Your GIS Welfare Portal password has been updated",
);

export default function ForgotPasswordSuccessPage() {
  return (
    <AuthShell>
      <PasswordResetProgress currentStep="reset" completed />
      <PasswordResetSuccessPanel />
    </AuthShell>
  );
}
