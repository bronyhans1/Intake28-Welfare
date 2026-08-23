import { notFound, redirect } from "next/navigation";
import { AdminSubmittedClaimDetail } from "@/components/admin/admin-submitted-claim-detail";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canViewAllClaims,
  getClaimById,
  isAdminReviewClaimStatus,
} from "@/lib/claims/claim-repository";
import { getClaimTypeConfigByCode } from "@/lib/claims/claim-type-repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { ClaimAmountMode } from "@/types/enums";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Submitted Claim",
  "View a submitted membership claim",
);

interface AdminSubmittedClaimDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminSubmittedClaimDetailPage({
  params,
}: AdminSubmittedClaimDetailPageProps) {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canViewAllClaims(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Submitted Claim" description="Unavailable">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured.
        </p>
      </AdminPageShell>
    );
  }

  const { id } = await params;
  const claim = await getClaimById(id);
  if (!claim || !isAdminReviewClaimStatus(claim.status)) {
    notFound();
  }

  const claimType = await getClaimTypeConfigByCode(claim.claimTypeCode);

  return (
    <AdminPageShell
      title={claim.claimNumber ?? "Claim"}
      description="Welfare Executive review. Approval confirms executive decision only — payment is not processed in this phase."
    >
      <AdminSubmittedClaimDetail
        claim={claim}
        amountMode={claimType?.amountMode ?? ClaimAmountMode.MANUAL}
      />
    </AdminPageShell>
  );
}
