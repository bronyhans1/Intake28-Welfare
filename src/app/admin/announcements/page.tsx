import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AnnouncementsTable } from "@/components/admin/announcements-table";
import { buttonVariants } from "@/components/ui/button";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canManageAnnouncements,
  canViewAnnouncements,
  listAnnouncements,
} from "@/lib/announcements/repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { announcementListQuerySchema } from "@/lib/validators/announcements";

export const metadata = createPageMetadata(
  "Announcements",
  "Create and manage welfare portal announcements",
);

export const dynamic = "force-dynamic";

interface AdminAnnouncementsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminAnnouncementsPage({
  searchParams,
}: AdminAnnouncementsPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewAnnouncements(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Announcements" description="Announcements are unavailable.">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured. Please check server environment variables.
        </p>
      </AdminPageShell>
    );
  }

  const rawParams = await searchParams;
  const parsed = announcementListQuerySchema.safeParse({
    page: rawParams.page,
    pageSize: rawParams.pageSize,
    search: typeof rawParams.search === "string" ? rawParams.search : undefined,
    audience: rawParams.audience,
    status: rawParams.status,
    publishedFrom: rawParams.publishedFrom,
    publishedTo: rawParams.publishedTo,
  });

  const query = parsed.success
    ? parsed.data
    : announcementListQuerySchema.parse({});
  const data = await listAnnouncements(query);
  const canManage = canManageAnnouncements(actor.role);

  return (
    <AdminPageShell
      title="Announcements"
      description="Publish notices and updates to members and executives."
      action={
        canManage ? (
          <Link
            href="/admin/announcements/new"
            className={buttonVariants({
              className: "bg-[#166534] text-white hover:bg-[#14532d]",
            })}
          >
            New Announcement
          </Link>
        ) : null
      }
    >
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <AnnouncementsTable data={data} canManage={canManage} />
      </Suspense>
    </AdminPageShell>
  );
}
