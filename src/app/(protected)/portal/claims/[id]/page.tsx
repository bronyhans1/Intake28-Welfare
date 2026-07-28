import { notFound, redirect } from "next/navigation";
import { MemberClaimDetail } from "@/components/member/member-claim-detail";
import { MemberPageShell } from "@/components/member/member-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canViewOwnClaims,
  getClaimById,
} from "@/lib/claims/claim-repository";
import {
  getPaymentById,
  toMemberVisiblePaymentSummary,
} from "@/lib/payments/repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Claim Details",
  "View your membership claim and activity timeline",
);

interface MemberClaimDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MemberClaimDetailPage({
  params,
}: MemberClaimDetailPageProps) {
  const actor = await getCurrentUserFromSession();
  if (!actor) redirect("/login");
  if (!canViewOwnClaims(actor.role)) redirect("/dashboard");

  if (!isFirebaseAdminConfigured()) {
    return (
      <MemberPageShell title="Claim Details">
        <p className="text-sm text-muted-foreground">
          Claims services are temporarily unavailable.
        </p>
      </MemberPageShell>
    );
  }

  const { id } = await params;
  const claim = await getClaimById(id);
  if (!claim || claim.memberId !== actor.uid) {
    notFound();
  }

  let payment = null;
  if (claim.paymentId) {
    const full = await getPaymentById(claim.paymentId);
    if (full) payment = toMemberVisiblePaymentSummary(full);
  }

  return (
    <MemberPageShell
      title={claim.claimNumber ?? claim.reference}
      description="Claim details and activity timeline for your submission."
    >
      <MemberClaimDetail claim={claim} payment={payment} />
    </MemberPageShell>
  );
}
