import { notFound, redirect } from "next/navigation";
import { AdminBreadcrumb, AdminPageShell } from "@/components/admin/admin-page-shell";
import { AnnouncementsEditForm } from "@/components/admin/announcements-edit-form";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canArchiveAnnouncements,
  canManageAnnouncements,
  getAnnouncementById,
} from "@/lib/announcements/repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const metadata = createPageMetadata(
  "Edit Announcement",
  "Update announcement details",
);

interface EditAnnouncementPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAnnouncementPage({
  params,
}: EditAnnouncementPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canManageAnnouncements(actor.role)) {
    redirect("/admin/announcements");
  }

  if (!isFirebaseAdminConfigured()) {
    redirect("/admin/announcements");
  }

  const { id } = await params;
  const record = await getAnnouncementById(id);

  if (!record) {
    notFound();
  }

  return (
    <AdminPageShell
      title="Edit Announcement"
      description="Update announcement content, audience, and status."
    >
      <AdminBreadcrumb
        items={[
          { label: "Announcements", href: "/admin/announcements" },
          { label: record.title, href: `/admin/announcements/${record.id}` },
          { label: "Edit" },
        ]}
      />
      <AnnouncementsEditForm
        record={record}
        canArchive={canArchiveAnnouncements(actor.role)}
      />
    </AdminPageShell>
  );
}
