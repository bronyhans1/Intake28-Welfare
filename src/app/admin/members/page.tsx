import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { MembersTable } from "@/components/admin/members-table";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canManageMembers,
  canViewMembers,
  listMembers,
} from "@/lib/members/repository";
import { memberListQuerySchema } from "@/lib/validators/member";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Members",
  "Manage GIS Intake 28 welfare portal members",
);

interface AdminMembersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminMembersPage({
  searchParams,
}: AdminMembersPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewMembers(actor.role)) {
    redirect("/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Members" description="Member management is unavailable.">
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
    role: rawParams.role,
    status: rawParams.status,
    activationStatus:
      rawParams.activationStatus ??
      (typeof rawParams.activation === "string" ? rawParams.activation : undefined),
  });

  const query = parsed.success
    ? parsed.data
    : memberListQuerySchema.parse({});

  const data = await listMembers(query);
  const canManage = canManageMembers(actor.role);

  return (
    <AdminPageShell
      title="Members"
      description="Search, filter, and manage GIS Intake 28 welfare members."
      action={
        canManage ? (
          <Link
            href="/admin/members/new"
            className={buttonVariants({
              className: "bg-[#166534] text-white hover:bg-[#14532d]",
            })}
          >
            Add Member
          </Link>
        ) : null
      }
    >
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <MembersTable data={data} canManage={canManage} />
      </Suspense>
    </AdminPageShell>
  );
}
