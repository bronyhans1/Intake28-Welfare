import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MemberNotificationsCentre } from "@/components/member/member-notifications-centre";
import { MemberPageShell } from "@/components/member/member-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canAccessNotificationCentre,
  listNotificationsForUser,
  notificationListQuerySchema,
} from "@/lib/notifications/repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Notifications",
  "Your welfare portal notifications",
);

interface MemberNotificationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MemberNotificationsPage({
  searchParams,
}: MemberNotificationsPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    redirect("/login");
  }

  if (!canAccessNotificationCentre(actor.role)) {
    redirect("/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <MemberPageShell title="Notifications" description="Notifications are unavailable.">
        <p className="text-sm text-muted-foreground">
          Services are temporarily unavailable. Please try again later.
        </p>
      </MemberPageShell>
    );
  }

  const rawParams = await searchParams;
  const parsed = notificationListQuerySchema.safeParse({
    page: rawParams.page,
    pageSize: rawParams.pageSize,
    status: rawParams.status,
  });

  const query = parsed.success
    ? parsed.data
    : notificationListQuerySchema.parse({});

  const data = await listNotificationsForUser(actor, query);

  return (
    <MemberPageShell
      title="Notification Centre"
      description="Updates about your claims, contributions, payments, and announcements."
    >
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <MemberNotificationsCentre data={data} />
      </Suspense>
    </MemberPageShell>
  );
}
