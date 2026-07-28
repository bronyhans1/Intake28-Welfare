import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { ReportsWorkspace } from "@/components/admin/reports-workspace";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { listContributions } from "@/lib/contributions/repository";
import { listDefaulters } from "@/lib/finance/defaulters";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { listMembers } from "@/lib/members/repository";
import { canExportReports, canViewReports } from "@/lib/reports/permissions";
import {
  getFinancialSummaryReport,
  getReportsDashboardSummary,
} from "@/lib/reports/summary";
import { listWelfareSupport } from "@/lib/welfare/repository";
import { listReceipts } from "@/lib/receipts/repository";
import { listMembershipProgressionReportRows } from "@/lib/reports/export/membership-progression";
import { listOutstandingContributionsReportRows } from "@/lib/reports/export/outstanding-contributions";
import { reportsPageQuerySchema } from "@/lib/validators/reports";
import { UserStatus } from "@/types/enums";

export const metadata = createPageMetadata(
  "Reports",
  "Filterable financial, contribution, welfare, and defaulter reports",
);

export const dynamic = "force-dynamic";

interface AdminReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminReportsPage({
  searchParams,
}: AdminReportsPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewReports(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Reports" description="Reports are unavailable.">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured. Please check server environment variables.
        </p>
      </AdminPageShell>
    );
  }

  const rawParams = await searchParams;
  const parsed = reportsPageQuerySchema.safeParse({
    tab: rawParams.tab,
    page: rawParams.page,
    pageSize: rawParams.pageSize,
    month: rawParams.month,
    year: rawParams.year,
    memberId: typeof rawParams.memberId === "string" ? rawParams.memberId : undefined,
    contributionType: rawParams.contributionType,
    supportType: rawParams.supportType,
    search: typeof rawParams.search === "string" ? rawParams.search : undefined,
    status: typeof rawParams.status === "string" ? rawParams.status : undefined,
  });

  const query = parsed.success ? parsed.data : reportsPageQuerySchema.parse({});
  const periodFilters = { month: query.month, year: query.year };

  const [
    dashboardSummary,
    financialSummaryReport,
    contributions,
    welfareSupport,
    defaulters,
    members,
    receipts,
    progression,
    outstanding,
  ] = await Promise.all([
    getReportsDashboardSummary(periodFilters),
    getFinancialSummaryReport(periodFilters),
    listContributions({
      page: query.page,
      pageSize: query.pageSize,
      month: query.month,
      year: query.year,
      memberId: query.memberId,
      contributionType: query.contributionType,
    }),
    listWelfareSupport({
      page: query.page,
      pageSize: query.pageSize,
      supportMonth: query.month,
      supportYear: query.year,
      memberId: query.memberId,
      supportType: query.supportType,
    }),
    listDefaulters({
      page: query.page,
      pageSize: query.pageSize,
      month: query.month,
      year: query.year,
    }),
    listMembers({
      page: 1,
      pageSize: 100,
      status: UserStatus.ACTIVE,
    }),
    listReceipts({
      page: query.page,
      pageSize: query.pageSize,
      month: query.month,
      year: query.year,
      memberId: query.memberId,
    }),
    listMembershipProgressionReportRows({
      page: query.page,
      pageSize: query.pageSize,
    }),
    listOutstandingContributionsReportRows({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status,
      memberId: query.memberId,
    }),
  ]);

  return (
    <AdminPageShell
      title="Reports"
      description="Filter, review, and export welfare scheme reports."
    >
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <ReportsWorkspace
          query={query}
          dashboardSummary={dashboardSummary}
          financialSummaryReport={financialSummaryReport}
          contributions={contributions}
          welfareSupport={welfareSupport}
          defaulters={defaulters}
          receipts={receipts}
          progression={progression}
          outstanding={outstanding}
          members={members.members}
          canExport={canExportReports(actor.role)}
        />
      </Suspense>
    </AdminPageShell>
  );
}
