import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MemberReceiptsTable } from "@/components/member/member-receipts-table";
import { MemberPageShell } from "@/components/member/member-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { listMemberReceipts } from "@/lib/receipts/repository";
import { receiptListQuerySchema } from "@/lib/validators/receipts";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Receipts",
  "View and download your welfare payment receipts",
);

interface ReceiptsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReceiptsPage({ searchParams }: ReceiptsPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    redirect("/login");
  }

  if (!hasPermission(actor.role, Permission.VIEW_RECEIPTS)) {
    redirect("/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <MemberPageShell title="Receipts" description="Receipts are unavailable.">
        <p className="text-sm text-muted-foreground">
          Services are temporarily unavailable. Please try again later.
        </p>
      </MemberPageShell>
    );
  }

  const params = await searchParams;
  const parsed = receiptListQuerySchema.safeParse({
    page: params.page,
    pageSize: params.pageSize,
    search: params.search,
    month: params.month,
    year: params.year,
  });

  const query = parsed.success
    ? parsed.data
    : receiptListQuerySchema.parse({ page: 1, pageSize: 20 });

  const data = await listMemberReceipts(actor.uid, query);

  return (
    <MemberPageShell
      title="My Receipts"
      description="Download official receipts for your verified welfare payments."
    >
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <MemberReceiptsTable data={data} />
      </Suspense>
    </MemberPageShell>
  );
}
