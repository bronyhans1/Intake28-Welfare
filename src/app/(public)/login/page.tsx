import { LoginForm } from "@/components/forms/login-form";
import { AuthShell } from "@/components/layout/auth-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";

export const metadata = createPageMetadata(
  "Login",
  "Sign in with your GIS service number and password",
);

export default function LoginPage() {
  return (
    <AuthShell executive footer={null}>
      <LoginForm />
    </AuthShell>
  );
}
