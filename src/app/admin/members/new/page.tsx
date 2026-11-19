import { redirect } from "next/navigation";
import { AdminBackLink, AdminBreadcrumb, AdminPageShell } from "@/components/admin/admin-page-shell";
import { MemberForm } from "@/components/admin/member-form";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { canManageMembers } from "@/lib/members/repository";

export const metadata = createPageMetadata(
  "Add Member",
  "Create a new GIS welfare member record",
);

export default async function NewMemberPage() {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canManageMembers(actor.role)) {
    redirect("/admin/members");
  }

  return (
    <AdminPageShell
      title="Add Member"
      description="Create a new member record. Members activate their own accounts later."
    >
      <AdminBreadcrumb
        items={[
          { label: "Members", href: "/admin/members" },
          { label: "Add Member" },
        ]}
      />
      <AdminBackLink href="/admin/members" label="Back to members" />
      <MemberForm mode="create" />
    </AdminPageShell>
  );
}
