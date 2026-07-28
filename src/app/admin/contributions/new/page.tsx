import { redirect } from "next/navigation";
import { AdminBreadcrumb, AdminPageShell } from "@/components/admin/admin-page-shell";
import { ContributionsNewForm } from "@/components/admin/contributions-new-form";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { canManageContributions } from "@/lib/contributions/repository";
import { listMembers } from "@/lib/members/repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { getMonthlyDuesAmount } from "@/lib/system-settings/repository";

export const metadata = createPageMetadata(
  "Record Contribution",
  "Record a new contribution entry",
);

export default async function NewContributionPage() {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canManageContributions(actor.role)) {
    redirect("/admin/contributions");
  }

  if (!isFirebaseAdminConfigured()) {
    redirect("/admin/contributions");
  }

  const membersData = await listMembers({ page: 1, pageSize: 500 });
  const monthlyDuesAmount = await getMonthlyDuesAmount();

  return (
    <AdminPageShell
      title="Record Contribution"
      description="Record money contributed into the welfare scheme."
    >
      <AdminBreadcrumb
        items={[
          { label: "Contributions", href: "/admin/contributions" },
          { label: "Record Contribution" },
        ]}
      />
      <ContributionsNewForm
        members={membersData.members}
        monthlyDuesAmount={monthlyDuesAmount}
      />
    </AdminPageShell>
  );
}

