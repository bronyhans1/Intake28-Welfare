import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DefaultersTable } from "@/components/admin/defaulters-table";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { canViewFinanceDashboard } from "@/lib/finance/dashboard";
import { listDefaulters } from "@/lib/finance/defaulters";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { defaulterListQuerySchema } from "@/lib/validators/defaulters";

export const metadata = createPageMetadata(
  "Defaulters",
  "Members with outstanding welfare contribution months",
);

export const dynamic = "force-dynamic";

interface DefaultersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DefaultersPage({ searchParams }: DefaultersPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewFinanceDashboard(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Defaulters" description="Defaulters list is unavailable.">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured. Please check server environment variables.
        </p>
      </AdminPageShell>
    );
  }

  const rawParams = await searchParams;
  const parsed = defaulterListQuerySchema.safeParse({
    page: rawParams.page,
    pageSize: rawParams.pageSize,
    search: typeof rawParams.search === "string" ? rawParams.search : undefined,
    month: rawParams.month,
    year: rawParams.year,
  });

  const query = parsed.success
    ? parsed.data
    : defaulterListQuerySchema.parse({});

  const data = await listDefaulters(query);

  return (
    <AdminPageShell
      title="Defaulters"
      description="Active members with unpaid contribution months from the Membership Progression Engine — the same outstanding months members see on their dashboard."
    >
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <DefaultersTable data={data} />
      </Suspense>
    </AdminPageShell>
  );
}
