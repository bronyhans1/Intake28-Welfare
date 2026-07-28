import { redirect } from "next/navigation";
import { AdminBreadcrumb, AdminPageShell } from "@/components/admin/admin-page-shell";
import { AnnouncementsNewForm } from "@/components/admin/announcements-new-form";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { canManageAnnouncements } from "@/lib/announcements/repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const metadata = createPageMetadata(
  "New Announcement",
  "Create a new portal announcement",
);

export default async function NewAnnouncementPage() {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canManageAnnouncements(actor.role)) {
    redirect("/admin/announcements");
  }

  if (!isFirebaseAdminConfigured()) {
    redirect("/admin/announcements");
  }

  return (
    <AdminPageShell
      title="New Announcement"
      description="Create an announcement for members or executives."
    >
      <AdminBreadcrumb
        items={[
          { label: "Announcements", href: "/admin/announcements" },
          { label: "New Announcement" },
        ]}
      />
      <AnnouncementsNewForm />
    </AdminPageShell>
  );
}
