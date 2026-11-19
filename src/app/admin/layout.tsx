import { Suspense } from "react";
import { RequireAdmin } from "@/components/auth/require-auth";
import { AdminLayout } from "@/components/admin/admin-layout";
import { ToastFromSearchParams } from "@/components/shared/toast-from-search-params";

export default function AdminLayoutRoot({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAdmin>
      <Suspense fallback={null}>
        <ToastFromSearchParams />
      </Suspense>
      <AdminLayout>{children}</AdminLayout>
    </RequireAdmin>
  );
}
