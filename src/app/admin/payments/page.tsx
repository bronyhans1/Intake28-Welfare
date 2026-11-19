import { redirect } from "next/navigation";
import { AdminPaymentsLedger } from "@/components/admin/admin-payments-ledger";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { canViewPayments, listPayments } from "@/lib/payments/repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { paymentListQuerySchema } from "@/lib/validators/payments";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Payments",
  "Unified payments ledger for contributions and claim payments",
);

interface AdminPaymentsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminPaymentsPage({
  searchParams,
}: AdminPaymentsPageProps) {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canViewPayments(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Payments" description="Unavailable">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured.
        </p>
      </AdminPageShell>
    );
  }

  const raw = await searchParams;
  const parsed = paymentListQuerySchema.safeParse({
    page: raw.page,
    pageSize: raw.pageSize,
    search: typeof raw.search === "string" ? raw.search : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
    paymentCategory:
      typeof raw.paymentCategory === "string" ? raw.paymentCategory : undefined,
    paymentMethod:
      typeof raw.paymentMethod === "string" ? raw.paymentMethod : undefined,
  });
  const query = parsed.success
    ? parsed.data
    : paymentListQuerySchema.parse({});

  const data = await listPayments(query, actor);

  return (
    <AdminPageShell
      title="Payments"
      description="Single financial ledger for contribution and claim payments."
    >
      <AdminPaymentsLedger
        data={data}
        search={query.search ?? ""}
        paymentCategory={query.paymentCategory ?? ""}
        paymentMethod={query.paymentMethod ?? ""}
        status={query.status ?? ""}
      />
    </AdminPageShell>
  );
}
