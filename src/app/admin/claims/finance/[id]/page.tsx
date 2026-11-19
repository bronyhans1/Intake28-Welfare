import { notFound, redirect } from "next/navigation";
import { AdminFinanceClaimDetail } from "@/components/admin/admin-finance-claim-detail";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canProcessClaimPayments,
  isFinanceClaimStatus,
} from "@/lib/claims/claim-access";
import {
  canViewAllClaims,
  getClaimById,
} from "@/lib/claims/claim-repository";
import {
  getPaymentById,
  toMemberVisiblePaymentSummary,
} from "@/lib/payments/repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Finance Claim",
  "Process a membership claim payment",
);

interface AdminFinanceClaimDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminFinanceClaimDetailPage({
  params,
}: AdminFinanceClaimDetailPageProps) {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canViewAllClaims(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Finance Claim" description="Unavailable">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured.
        </p>
      </AdminPageShell>
    );
  }

  const { id } = await params;
  const claim = await getClaimById(id);
  if (!claim || !isFinanceClaimStatus(claim.status)) {
    notFound();
  }

  let payment = null;
  if (claim.paymentId) {
    const full = await getPaymentById(claim.paymentId);
    if (full) payment = toMemberVisiblePaymentSummary(full);
  }

  return (
    <AdminPageShell
      title={claim.claimNumber ?? "Finance Claim"}
      description="Record claim payment in the unified Payments ledger."
    >
      <AdminFinanceClaimDetail
        claim={claim}
        payment={payment}
        canProcessPayments={canProcessClaimPayments(actor.role)}
      />
    </AdminPageShell>
  );
}
