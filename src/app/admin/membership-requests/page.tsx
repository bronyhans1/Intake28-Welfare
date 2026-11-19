import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { MembershipRequestsTable } from "@/components/admin/membership-requests-table";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  canReviewMembershipRequests,
  canViewMembershipRequests,
  listMembershipRequests,
} from "@/lib/membership-requests/repository";
import { membershipRequestListQuerySchema } from "@/lib/validators/membership-request";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Membership Requests",
  "Review public access requests",
);

interface MembershipRequestsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MembershipRequestsPage({
  searchParams,
}: MembershipRequestsPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewMembershipRequests(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell
        title="Membership Requests"
        description="Membership requests unavailable."
      >
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured. Please check server environment
          variables.
        </p>
      </AdminPageShell>
    );
  }

  const rawParams = await searchParams;
  const parsed = membershipRequestListQuerySchema.safeParse({
    page: rawParams.page,
    pageSize: rawParams.pageSize,
    search: typeof rawParams.search === "string" ? rawParams.search : undefined,
    status: typeof rawParams.status === "string" ? rawParams.status : undefined,
    sort: typeof rawParams.sort === "string" ? rawParams.sort : undefined,
  });

  const query = parsed.success
    ? parsed.data
    : membershipRequestListQuerySchema.parse({});

  const data = await listMembershipRequests(query);

  return (
    <AdminPageShell
      title="Membership Requests"
      description="Review and approve public requests to join the welfare portal."
    >
      <Suspense
        fallback={
          <div className="text-sm text-muted-foreground">Loading…</div>
        }
      >
        <MembershipRequestsTable
          data={data}
          canReview={canReviewMembershipRequests(actor.role)}
        />
      </Suspense>
    </AdminPageShell>
  );
}
