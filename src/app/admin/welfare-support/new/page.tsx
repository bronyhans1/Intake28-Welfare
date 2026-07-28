import { redirect } from "next/navigation";
import { AdminBreadcrumb, AdminPageShell } from "@/components/admin/admin-page-shell";
import { MemberPickerForm } from "@/components/admin/welfare-support-new-form";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { canManageWelfareSupport } from "@/lib/welfare/repository";
import { listMembers } from "@/lib/members/repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const metadata = createPageMetadata(
  "Record Welfare Support",
  "Record a new welfare support entry",
);

export default async function NewWelfareSupportPage() {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canManageWelfareSupport(actor.role)) {
    redirect("/admin/welfare-support");
  }

  if (!isFirebaseAdminConfigured()) {
    redirect("/admin/welfare-support");
  }

  const membersData = await listMembers({ page: 1, pageSize: 500 });
  const members = membersData.members;

  return (
    <AdminPageShell
      title="Record Welfare Support"
      description="Record welfare assistance provided to a member."
    >
      <AdminBreadcrumb
        items={[
          { label: "Welfare Support", href: "/admin/welfare-support" },
          { label: "Record Support" },
        ]}
      />
      <MemberPickerForm members={members} />
    </AdminPageShell>
  );
}
