import { Suspense } from "react";
import { RequireMember } from "@/components/auth/require-auth";
import { MemberLayout } from "@/components/member/member-layout";
import { ToastFromSearchParams } from "@/components/shared/toast-from-search-params";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireMember>
      <Suspense fallback={null}>
        <ToastFromSearchParams />
      </Suspense>
      <MemberLayout>{children}</MemberLayout>
    </RequireMember>
  );
}
