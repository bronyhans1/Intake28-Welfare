import { redirect } from "next/navigation";
import { MemberAnnouncementsList } from "@/components/member/member-announcements";
import { MemberPageShell } from "@/components/member/member-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { listVisibleAnnouncementsForUser } from "@/lib/announcements/repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Announcements",
  "Portal announcements and notices",
);

export default async function MemberAnnouncementsPage() {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    redirect("/login");
  }

  if (!hasPermission(actor.role, Permission.VIEW_ANNOUNCEMENTS)) {
    redirect("/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <MemberPageShell title="Announcements" description="Announcements are unavailable.">
        <p className="text-sm text-muted-foreground">
          Services are temporarily unavailable. Please try again later.
        </p>
      </MemberPageShell>
    );
  }

  const announcements = await listVisibleAnnouncementsForUser(actor);

  return (
    <MemberPageShell
      title="Announcements"
      description="Important notices and updates from the welfare office."
    >
      <MemberAnnouncementsList announcements={announcements} />
    </MemberPageShell>
  );
}
