import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AwaitingPaymentClaimsPanel } from "@/components/admin/awaiting-payment-claims-panel";
import { WelfareSupportTable } from "@/components/admin/welfare-support-table";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { canProcessClaimPayments } from "@/lib/claims/claim-access";
import { listAwaitingPaymentClaims } from "@/lib/claims/claim-repository";
import {
  canManageWelfareSupport,
  canViewWelfareSupport,
} from "@/lib/welfare/repository";
import { listWelfareHistory } from "@/lib/welfare/history";
import { welfareSupportListQuerySchema } from "@/lib/validators/welfare-support";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  listAllWelfareSupportTypeOptions,
  seedDefaultWelfareSupportTypes,
} from "@/lib/welfare-support-types/repository";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Welfare Records",
  "Pay approved claims and manage standalone welfare support records",
);

interface AdminWelfareSupportPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminWelfareSupportPage({
  searchParams,
}: AdminWelfareSupportPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewWelfareSupport(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Welfare Support" description="Welfare support is unavailable.">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured. Please check server environment variables.
        </p>
      </AdminPageShell>
    );
  }

  const rawParams = await searchParams;
  const parsed = welfareSupportListQuerySchema.safeParse({
    page: rawParams.page,
    pageSize: rawParams.pageSize,
    search: typeof rawParams.search === "string" ? rawParams.search : undefined,
    source: rawParams.source,
    supportType: rawParams.supportType,
    status: rawParams.status,
  });

  const query = parsed.success ? parsed.data : welfareSupportListQuerySchema.parse({});

  await seedDefaultWelfareSupportTypes(actor);
  const canManage = canManageWelfareSupport(actor.role);
  const canPayClaims = canProcessClaimPayments(actor.role);

  const [data, supportTypes, awaitingClaims] = await Promise.all([
    listWelfareHistory(query),
    listAllWelfareSupportTypeOptions(),
    canPayClaims ? listAwaitingPaymentClaims() : Promise.resolve([]),
  ]);

  return (
    <AdminPageShell
      title="Welfare Records"
      description="View welfare payment history, pay approved claims awaiting payment, or record standalone welfare assistance."
      action={
        canManage ? (
          <Link
            href="/admin/welfare-support/new"
            className={buttonVariants({
              className: "bg-[#166534] text-white hover:bg-[#14532d]",
            })}
          >
            Record / Pay
          </Link>
        ) : null
      }
    >
      <div className="space-y-6">
        {canPayClaims ? (
          <AwaitingPaymentClaimsPanel claims={awaitingClaims} canPay={canPayClaims} />
        ) : null}
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
          <WelfareSupportTable
            data={data}
            canManage={canManage}
            supportTypes={supportTypes}
          />
        </Suspense>
      </div>
    </AdminPageShell>
  );
}
