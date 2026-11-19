import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminBreadcrumb, AdminPageShell } from "@/components/admin/admin-page-shell";
import { MemberPickerForm } from "@/components/admin/welfare-support-new-form";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { canManageWelfareSupport } from "@/lib/welfare/repository";
import { listMembers } from "@/lib/members/repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { canProcessClaimPayments } from "@/lib/claims/claim-access";
import {
  listActiveWelfareSupportTypes,
  seedDefaultWelfareSupportTypes,
} from "@/lib/welfare-support-types/repository";

export const metadata = createPageMetadata(
  "Welfare Records Desk",
  "Pay approved member claims and record standalone welfare support",
);

export default async function NewWelfareSupportPage() {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canManageWelfareSupport(actor.role)) {
    redirect("/admin/welfare-support");
  }

  if (!isFirebaseAdminConfigured()) {
    redirect("/admin/welfare-support");
  }

  // Ensure default catalog exists without overwriting admin edits.
  await seedDefaultWelfareSupportTypes(actor);

  const [membersData, supportTypes] = await Promise.all([
    listMembers({ page: 1, pageSize: 500 }),
    listActiveWelfareSupportTypes(),
  ]);
  const members = membersData.members;

  return (
    <AdminPageShell
      title="Welfare Records Desk"
      description="Pay approved member claims awaiting payment, or record standalone welfare assistance that did not come from a claim."
    >
      <AdminBreadcrumb
        items={[
          { label: "Welfare Records", href: "/admin/welfare-support" },
          { label: "Record / Pay" },
        ]}
      />
      <div className="space-y-6">
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
          <MemberPickerForm
            members={members}
            supportTypes={supportTypes}
            canProcessClaimPayments={canProcessClaimPayments(actor.role)}
          />
        </Suspense>
      </div>
    </AdminPageShell>
  );
}
