import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { PendingMembersTable } from "@/components/admin/pending-members-table";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  canManageMembers,
  canViewMembers,
  listMembers,
} from "@/lib/members/repository";
import { memberListQuerySchema } from "@/lib/validators/member";
import { ActivationStatus } from "@/types/enums";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Pending Activation",
  "Members awaiting account activation",
);

interface PendingMembersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PendingMembersPage({
  searchParams,
}: PendingMembersPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewMembers(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Pending Activation" description="Member list unavailable.">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured. Please check server environment variables.
        </p>
      </AdminPageShell>
    );
  }

  const rawParams = await searchParams;
  const parsed = memberListQuerySchema.safeParse({
    page: rawParams.page,
    pageSize: rawParams.pageSize,
    search: typeof rawParams.search === "string" ? rawParams.search : undefined,
    activationStatus:
      rawParams.activationStatus ??
      (typeof rawParams.activation === "string" ? rawParams.activation : undefined),
  });

  const query = parsed.success
    ? {
        ...parsed.data,
        activationStatus:
          parsed.data.activationStatus ?? ActivationStatus.PENDING,
      }
    : memberListQuerySchema.parse({ activationStatus: ActivationStatus.PENDING });

  const allPending = await listMembers({
    ...query,
    activationStatus: query.activationStatus ?? ActivationStatus.PENDING,
    page: 1,
    pageSize: 10000,
  });

  const nonActivated = allPending.members.filter(
    (member) => member.activationStatus !== ActivationStatus.ACTIVATED,
  );

  const pageSize = query.pageSize;
  const total = nonActivated.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * pageSize;

  const data = {
    members: nonActivated.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  };

  return (
    <AdminPageShell
      title="Pending Activation"
      description="Members who have not yet activated their accounts."
    >
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <PendingMembersTable data={data} canManage={canManageMembers(actor.role)} />
      </Suspense>
    </AdminPageShell>
  );
}
