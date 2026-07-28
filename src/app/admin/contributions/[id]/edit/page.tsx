import { notFound, redirect } from "next/navigation";
import { AdminBreadcrumb, AdminPageShell } from "@/components/admin/admin-page-shell";
import { ContributionsEditForm } from "@/components/admin/contributions-edit-form";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canManageContributions,
  canViewContributions,
  getContributionById,
} from "@/lib/contributions/repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const metadata = createPageMetadata(
  "Edit Contribution",
  "Edit an existing contribution record",
);

interface EditContributionPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditContributionPage({
  params,
}: EditContributionPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewContributions(actor.role) || !canManageContributions(actor.role)) {
    redirect("/admin/contributions");
  }

  if (!isFirebaseAdminConfigured()) {
    redirect("/admin/contributions");
  }

  const { id } = await params;
  const record = await getContributionById(id);

  if (!record) {
    notFound();
  }

  return (
    <AdminPageShell
      title="Edit Contribution"
      description="Update contribution type, amount, or remarks."
    >
      <AdminBreadcrumb
        items={[
          { label: "Contributions", href: "/admin/contributions" },
          { label: record.memberName, href: `/admin/contributions/${record.id}` },
          { label: "Edit" },
        ]}
      />
      <ContributionsEditForm record={record} />
    </AdminPageShell>
  );
}

