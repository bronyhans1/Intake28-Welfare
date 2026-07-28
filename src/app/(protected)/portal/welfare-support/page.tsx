import { redirect } from "next/navigation";
import { MemberPageShell } from "@/components/member/member-page-shell";
import { MemberWelfareSupportTable } from "@/components/member/member-welfare-support";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { listWelfareSupport } from "@/lib/welfare/repository";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "My Welfare Support",
  "View welfare support granted to you",
);

export default async function MemberWelfareSupportPage() {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    redirect("/login");
  }

  if (!hasPermission(actor.role, Permission.VIEW_OWN_WELFARE_SUPPORT)) {
    redirect("/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <MemberPageShell title="My Welfare Support" description="Welfare support is unavailable.">
        <p className="text-sm text-muted-foreground">
          Services are temporarily unavailable. Please try again later.
        </p>
      </MemberPageShell>
    );
  }

  const data = await listWelfareSupport({
    memberId: actor.uid,
    page: 1,
    pageSize: 100,
  });

  return (
    <MemberPageShell
      title="My Welfare Support"
      description="Welfare assistance granted to you by the welfare office."
    >
      <MemberWelfareSupportTable records={data.records} />
    </MemberPageShell>
  );
}
