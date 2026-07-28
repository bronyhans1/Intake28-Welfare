import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { NotificationsTable } from "@/components/admin/notifications-table";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canManageNotifications,
  canViewNotifications,
  listNotificationsForUser,
  notificationListQuerySchema,
} from "@/lib/notifications/repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const metadata = createPageMetadata(
  "Notifications",
  "Unified notification delivery history",
);

export const dynamic = "force-dynamic";

interface AdminNotificationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminNotificationsPage({
  searchParams,
}: AdminNotificationsPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewNotifications(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Notifications" description="Notifications are unavailable.">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured. Please check server environment variables.
        </p>
      </AdminPageShell>
    );
  }

  const rawParams = await searchParams;
  const parsed = notificationListQuerySchema.safeParse({
    page: rawParams.page,
    pageSize: rawParams.pageSize,
    search: typeof rawParams.search === "string" ? rawParams.search : undefined,
    status: rawParams.status,
  });

  const query = parsed.success
    ? parsed.data
    : notificationListQuerySchema.parse({});
  const data = await listNotificationsForUser(actor, query);
  const canManage = canManageNotifications(actor.role);

  return (
    <AdminPageShell
      title="Notifications"
      description="Unified notification delivery history across Claims, Contributions, Payments, Profile, and Announcements."
    >
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <NotificationsTable data={data} canManage={canManage} />
      </Suspense>
    </AdminPageShell>
  );
}
