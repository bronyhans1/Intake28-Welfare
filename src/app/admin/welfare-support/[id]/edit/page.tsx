import { notFound, redirect } from "next/navigation";
import { AdminBreadcrumb, AdminPageShell } from "@/components/admin/admin-page-shell";
import { EditWelfareSupportForm } from "@/components/admin/welfare-support-form";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canManageWelfareSupport,
  getWelfareSupportById,
} from "@/lib/welfare/repository";
import { hasPermission, Permission } from "@/lib/auth/permissions";

export const metadata = createPageMetadata(
  "Edit Welfare Support",
  "Edit a welfare support record",
);

interface EditWelfareSupportPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditWelfareSupportPage({
  params,
}: EditWelfareSupportPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !hasPermission(actor.role, Permission.EDIT_WELFARE_SUPPORT)) {
    redirect("/admin/welfare-support");
  }

  const { id } = await params;
  const record = await getWelfareSupportById(id);

  if (!record) {
    notFound();
  }

  return (
    <AdminPageShell
      title="Edit Welfare Support"
      description="Update the support type, amount, or description."
    >
      <AdminBreadcrumb
        items={[
          { label: "Welfare Support", href: "/admin/welfare-support" },
          { label: record.memberName, href: `/admin/welfare-support/${record.id}` },
          { label: "Edit" },
        ]}
      />
      <EditWelfareSupportForm record={record} />
    </AdminPageShell>
  );
}
