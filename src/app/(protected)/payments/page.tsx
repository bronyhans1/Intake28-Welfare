import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  MemberPaymentsTable,
  PaymentVerificationBanner,
} from "@/components/member/member-payments";
import { MemberPageShell } from "@/components/member/member-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { listPayments } from "@/lib/payments/repository";
import { paymentListQuerySchema } from "@/lib/validators/payments";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Payments",
  "View your welfare payment history",
);

interface PaymentsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    redirect("/login");
  }

  const canAccess =
    hasPermission(actor.role, Permission.MAKE_PAYMENTS) ||
    hasPermission(actor.role, Permission.VIEW_PAYMENTS);

  if (!canAccess) {
    redirect("/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <MemberPageShell title="Payments" description="Payment history is unavailable.">
        <p className="text-sm text-muted-foreground">
          Services are temporarily unavailable. Please try again later.
        </p>
      </MemberPageShell>
    );
  }

  const params = await searchParams;
  const parsed = paymentListQuerySchema.safeParse({
    page: params.page,
    pageSize: params.pageSize,
    search: params.search,
    status: params.status,
    paymentType: params.paymentType,
  });

  const query = parsed.success
    ? parsed.data
    : paymentListQuerySchema.parse({ page: 1, pageSize: 20 });

  const data = await listPayments({ ...query, memberId: actor.uid }, actor);

  return (
    <MemberPageShell
      title="Payment History"
      description="Track your Paystack welfare payments and verification status."
    >
      <Suspense fallback={null}>
        <PaymentVerificationBanner />
      </Suspense>
      <MemberPaymentsTable data={data} />
    </MemberPageShell>
  );
}
