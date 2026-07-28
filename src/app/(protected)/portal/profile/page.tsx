import { redirect } from "next/navigation";
import { MemberProfileView } from "@/components/member/member-profile-view";
import { MemberPageShell } from "@/components/member/member-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { getMemberById } from "@/lib/members/repository";
import { isProfilePhotoStorageEnabled } from "@/lib/storage/profile-photo";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "My Profile",
  "View your GIS welfare portal profile.",
);

export default async function PortalProfilePage() {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    redirect("/login");
  }

  if (!hasPermission(actor.role, Permission.UPDATE_PROFILE)) {
    redirect("/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <MemberPageShell title="My Profile">
        <p className="text-sm text-muted-foreground">
          Profile services are temporarily unavailable. Please try again later.
        </p>
      </MemberPageShell>
    );
  }

  const member = await getMemberById(actor.uid);

  if (!member) {
    redirect("/login");
  }

  return (
    <MemberProfileView
      member={member}
      photoStorageEnabled={isProfilePhotoStorageEnabled()}
    />
  );
}
