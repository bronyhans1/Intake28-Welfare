import { redirect } from "next/navigation";
import { AdminFinanceClaimsTable } from "@/components/admin/admin-finance-claims-table";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canViewAllClaims,
  listFinanceClaims,
} from "@/lib/claims/claim-repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { financeClaimsListQuerySchema } from "@/lib/validators/claims";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Finance Claims",
  "Process approved membership claim payments",
);

interface AdminFinanceClaimsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminFinanceClaimsPage({
  searchParams,
}: AdminFinanceClaimsPageProps) {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canViewAllClaims(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Finance Claims" description="Unavailable">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured.
        </p>
      </AdminPageShell>
    );
  }

  const raw = await searchParams;
  const parsed = financeClaimsListQuerySchema.safeParse({
    page: raw.page,
    pageSize: raw.pageSize,
    search: typeof raw.search === "string" ? raw.search : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
    sortBy: typeof raw.sortBy === "string" ? raw.sortBy : undefined,
    sortDir: typeof raw.sortDir === "string" ? raw.sortDir : undefined,
  });
  const query = parsed.success
    ? parsed.data
    : financeClaimsListQuerySchema.parse({});

  const data = await listFinanceClaims(query);

  return (
    <AdminPageShell
      title="Finance Claims"
      description="Awaiting Payment, Payment Processing, and Paid queues. Payments are recorded in the unified Payments ledger."
    >
      <AdminFinanceClaimsTable
        data={data}
        search={query.search ?? ""}
        status={query.status ?? ""}
        sortBy={query.sortBy}
        sortDir={query.sortDir}
      />
    </AdminPageShell>
  );
}
