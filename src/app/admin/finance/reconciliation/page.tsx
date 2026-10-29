import { redirect } from "next/navigation";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { ReconciliationOverview } from "@/components/admin/reconciliation-overview";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canRecoverUnsettledPayments,
  canViewReconciliation,
} from "@/lib/finance/reconciliation-permissions";
import { getReconciliationSummary } from "@/lib/finance/reconciliation";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const metadata = createPageMetadata(
  "Reconciliation",
  "Financial reconciliation between payments, contributions, and receipts",
);

export const dynamic = "force-dynamic";

export default async function AdminReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewReconciliation(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Reconciliation" description="Reconciliation is unavailable.">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured. Please check server environment variables.
        </p>
      </AdminPageShell>
    );
  }

  const params = await searchParams;
  const summary = await getReconciliationSummary({
    paystackBatch: params.paystackBatch,
    hubtelBatch: params.hubtelBatch,
    hubtelForceRecheck: params.hubtelRecheck,
  });

  return (
    <AdminPageShell
      title="Financial Reconciliation"
      description="Detect gaps between successful payments, automated contributions, issued receipts, and Paystack or Hubtel charges that are still unsettled."
    >
      <ReconciliationOverview
        summary={summary}
        canRecoverUnsettledPayments={canRecoverUnsettledPayments(actor.role)}
      />
    </AdminPageShell>
  );
}
