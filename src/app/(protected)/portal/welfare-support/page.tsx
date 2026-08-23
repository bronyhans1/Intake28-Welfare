import { redirect } from "next/navigation";
import { MemberPageShell } from "@/components/member/member-page-shell";
import { MemberWelfareSupportTable } from "@/components/member/member-welfare-support";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { requireOwnMemberPortalAccess } from "@/lib/auth/require-member-portal";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { listMemberWelfareHistory } from "@/lib/welfare/history";
import { listAllWelfareSupportTypeOptions } from "@/lib/welfare-support-types/repository";

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

  await requireOwnMemberPortalAccess(actor, "/portal/welfare-support");

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

  const [data, supportTypes] = await Promise.all([
    listMemberWelfareHistory(actor, {
      page: 1,
      pageSize: 100,
    }),
    listAllWelfareSupportTypeOptions(),
  ]);
  const supportTypeLabelMap = Object.fromEntries(
    supportTypes.map((type) => [type.code, type.displayName]),
  );

  return (
    <MemberPageShell
      title="My Welfare Support"
      description="Welfare assistance and paid claim benefits granted to you."
    >
      <MemberWelfareSupportTable
        entries={data.entries}
        supportTypeLabelMap={supportTypeLabelMap}
      />
    </MemberPageShell>
  );
}
