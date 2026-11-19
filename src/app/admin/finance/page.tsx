import { redirect } from "next/navigation";
import { FinanceDashboardOverview } from "@/components/admin/finance-dashboard-overview";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canViewFinanceDashboard,
  formatExpectedDuesDashboardSummary,
  formatFinanceDashboardSummary,
} from "@/lib/finance/dashboard";
import { getExpectedDuesSummary } from "@/lib/finance/expected-dues";
import { getFinancialSummary } from "@/lib/finance/repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  getContributionStats,
  listContributions,
} from "@/lib/contributions/repository";
import { contributionListQuerySchema } from "@/lib/validators/contributions";
import { listWelfareSupport } from "@/lib/welfare/repository";
import { welfareSupportListQuerySchema } from "@/lib/validators/welfare-support";

export const metadata = createPageMetadata(
  "Finance Dashboard",
  "Financial overview of welfare contributions and support",
);

export const dynamic = "force-dynamic";

export default async function AdminFinanceDashboardPage() {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewFinanceDashboard(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell
        title="Finance Dashboard"
        description="Financial overview is unavailable."
      >
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured. Please check server environment variables.
        </p>
      </AdminPageShell>
    );
  }

  const [financialSummary, contributionStats, expectedDuesSummary, recentContributions, recentWelfareSupport] =
    await Promise.all([
      getFinancialSummary(),
      getContributionStats(),
      getExpectedDuesSummary(),
      listContributions(contributionListQuerySchema.parse({ page: 1, pageSize: 5 })),
      listWelfareSupport(welfareSupportListQuerySchema.parse({ page: 1, pageSize: 5 })),
    ]);

  const summary = formatFinanceDashboardSummary(financialSummary, contributionStats);
  const expectedDues = formatExpectedDuesDashboardSummary(expectedDuesSummary);

  return (
    <AdminPageShell
      title="Finance Dashboard"
      description="Overview of contributions collected, welfare support paid, and current balance."
    >
      <FinanceDashboardOverview
        summary={summary}
        expectedDues={expectedDues}
        recentContributions={recentContributions.records}
        recentWelfareSupport={recentWelfareSupport.records}
      />
    </AdminPageShell>
  );
}
