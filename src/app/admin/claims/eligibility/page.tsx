import { redirect } from "next/navigation";
import { AdminClaimEligibilityChecker } from "@/components/admin/admin-claim-eligibility-checker";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import {
  canManageClaimTypes,
  listClaimTypeConfigs,
} from "@/lib/claims/claim-type-repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { claimTypeListQuerySchema } from "@/lib/validators/claims";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Claim Eligibility",
  "Check whether a member can submit a membership claim",
);

export default async function AdminClaimEligibilityPage() {
  const actor = await getCurrentUserFromSession();

  if (
    !actor ||
    (!hasPermission(actor.role, Permission.VIEW_ALL_CLAIMS) &&
      !canManageClaimTypes(actor.role))
  ) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Claim Eligibility" description="Unavailable">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured.
        </p>
      </AdminPageShell>
    );
  }

  const data = await listClaimTypeConfigs(
    claimTypeListQuerySchema.parse({
      page: 1,
      pageSize: 100,
      active: "true",
    }),
  );

  return (
    <AdminPageShell
      title="Claim Eligibility"
      description="Run the Membership Claims eligibility engine for any member. This does not approve or reject claims."
    >
      <AdminClaimEligibilityChecker claimTypes={data.types} />
    </AdminPageShell>
  );
}
