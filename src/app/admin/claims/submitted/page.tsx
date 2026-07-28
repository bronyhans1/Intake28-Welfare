import { redirect } from "next/navigation";
import { AdminSubmittedClaimsTable } from "@/components/admin/admin-submitted-claims-table";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canViewAllClaims,
  listSubmittedClaims,
} from "@/lib/claims/claim-repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { submittedClaimsListQuerySchema } from "@/lib/validators/claims";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Submitted Claims",
  "Review membership claims submitted by members",
);

interface AdminSubmittedClaimsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminSubmittedClaimsPage({
  searchParams,
}: AdminSubmittedClaimsPageProps) {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canViewAllClaims(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Submitted Claims" description="Unavailable">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured.
        </p>
      </AdminPageShell>
    );
  }

  const raw = await searchParams;
  const search = typeof raw.search === "string" ? raw.search : undefined;
  const status = typeof raw.status === "string" ? raw.status : undefined;
  const sortBy = typeof raw.sortBy === "string" ? raw.sortBy : undefined;
  const sortDir = typeof raw.sortDir === "string" ? raw.sortDir : undefined;
  const parsed = submittedClaimsListQuerySchema.safeParse({
    page: raw.page,
    pageSize: raw.pageSize,
    search,
    status,
    sortBy,
    sortDir,
  });
  const query = parsed.success
    ? parsed.data
    : submittedClaimsListQuerySchema.parse({});

  const data = await listSubmittedClaims(query);

  return (
    <AdminPageShell
      title="Submitted Claims"
      description="Welfare Executive review dashboard for membership claims. Approval does not process payment."
    >
      <AdminSubmittedClaimsTable
        data={data}
        search={query.search ?? ""}
        status={query.status ?? ""}
        sortBy={query.sortBy}
        sortDir={query.sortDir}
      />
    </AdminPageShell>
  );
}
