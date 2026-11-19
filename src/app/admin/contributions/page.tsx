import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { ContributionsStatsCards } from "@/components/admin/contributions-stats-cards";
import { ContributionsTable } from "@/components/admin/contributions-table";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canManageContributions,
  canViewContributions,
  getContributionStats,
  listContributions,
} from "@/lib/contributions/repository";
import { contributionListQuerySchema } from "@/lib/validators/contributions";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const metadata = createPageMetadata("Manage Contributions");

interface AdminContributionsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = "force-dynamic";

export default async function AdminContributionsPage({
  searchParams,
}: AdminContributionsPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewContributions(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell
        title="Contributions"
        description="Contributions management is unavailable."
      >
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured. Please check server environment variables.
        </p>
      </AdminPageShell>
    );
  }

  const rawParams = await searchParams;
  const parsed = contributionListQuerySchema.safeParse({
    page: rawParams.page,
    pageSize: rawParams.pageSize,
    search: typeof rawParams.search === "string" ? rawParams.search : undefined,
    contributionType: rawParams.contributionType,
    status: rawParams.status,
    month: rawParams.month,
    year: rawParams.year,
  });

  const query = parsed.success
    ? parsed.data
    : contributionListQuerySchema.parse({});
  const [data, stats] = await Promise.all([
    listContributions(query),
    getContributionStats(),
  ]);
  const canManage = canManageContributions(actor.role);

  return (
    <AdminPageShell
      title="Contributions"
      description="Track monthly dues and other welfare scheme contributions."
      action={
        canManage ? (
          <Link
            href="/admin/contributions/new"
            className={buttonVariants({
              className: "bg-[#166534] text-white hover:bg-[#14532d]",
            })}
          >
            Record Contribution
          </Link>
        ) : null
      }
    >
      <ContributionsStatsCards stats={stats} />
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <ContributionsTable data={data} canManage={canManage} />
      </Suspense>
    </AdminPageShell>
  );
}
