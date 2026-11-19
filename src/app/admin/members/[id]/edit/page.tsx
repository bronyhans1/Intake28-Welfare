import { notFound, redirect } from "next/navigation";
import { AdminBackLink, AdminBreadcrumb, AdminPageShell } from "@/components/admin/admin-page-shell";
import { MemberForm } from "@/components/admin/member-form";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canManageMembers,
  getMemberById,
} from "@/lib/members/repository";

export const metadata = createPageMetadata(
  "Edit Member",
  "Update GIS welfare member details",
);

interface EditMemberPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditMemberPage({ params }: EditMemberPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canManageMembers(actor.role)) {
    redirect("/admin/members");
  }

  const { id } = await params;
  const member = await getMemberById(id);

  if (!member) {
    notFound();
  }

  return (
    <AdminPageShell
      title="Edit Member"
      description={`${member.fullName} · ${member.serviceNumber}`}
    >
      <AdminBreadcrumb
        items={[
          { label: "Members", href: "/admin/members" },
          { label: member.fullName, href: `/admin/members/${member.id}` },
          { label: "Edit" },
        ]}
      />
      <AdminBackLink href={`/admin/members/${member.id}`} label="Back to member" />
      <MemberForm mode="edit" member={member} />
    </AdminPageShell>
  );
}
