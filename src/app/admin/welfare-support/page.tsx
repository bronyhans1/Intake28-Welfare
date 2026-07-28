import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { WelfareSupportTable } from "@/components/admin/welfare-support-table";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canManageWelfareSupport,
  canViewWelfareSupport,
  listWelfareSupport,
} from "@/lib/welfare/repository";
import { welfareSupportListQuerySchema } from "@/lib/validators/welfare-support";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Welfare Support",
  "Manage welfare support records",
);

interface AdminWelfareSupportPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminWelfareSupportPage({
  searchParams,
}: AdminWelfareSupportPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewWelfareSupport(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Welfare Support" description="Welfare support is unavailable.">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured. Please check server environment variables.
        </p>
      </AdminPageShell>
    );
  }

  const rawParams = await searchParams;
  const parsed = welfareSupportListQuerySchema.safeParse({
    page: rawParams.page,
    pageSize: rawParams.pageSize,
    search: typeof rawParams.search === "string" ? rawParams.search : undefined,
    supportType: rawParams.supportType,
    status: rawParams.status,
  });

  const query = parsed.success ? parsed.data : welfareSupportListQuerySchema.parse({});
  const data = await listWelfareSupport(query);
  const canManage = canManageWelfareSupport(actor.role);

  return (
    <AdminPageShell
      title="Welfare Support"
      description="Record and manage welfare assistance provided to members."
      action={
        canManage ? (
          <Link
            href="/admin/welfare-support/new"
            className={buttonVariants({
              className: "bg-[#166534] text-white hover:bg-[#14532d]",
            })}
          >
            Record Support
          </Link>
        ) : null
      }
    >
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <WelfareSupportTable data={data} canManage={canManage} />
      </Suspense>
    </AdminPageShell>
  );
}
