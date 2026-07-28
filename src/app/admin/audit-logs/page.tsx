import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AuditLogsTable } from "@/components/admin/audit-logs-table";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { canViewAuditLogs, listAuditLogs } from "@/lib/audit/repository";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { auditLogListQuerySchema } from "@/lib/validators/audit-log";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Audit Logs",
  "System activity and change history",
);

interface AuditLogsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AuditLogsPage({
  searchParams,
}: AuditLogsPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewAuditLogs(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Audit Logs" description="Audit logs are unavailable.">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured. Please check server environment variables.
        </p>
      </AdminPageShell>
    );
  }

  const rawParams = await searchParams;
  const parsed = auditLogListQuerySchema.safeParse({
    page: rawParams.page,
    pageSize: rawParams.pageSize,
    search: typeof rawParams.search === "string" ? rawParams.search : undefined,
    action: rawParams.action,
    actor: rawParams.actor,
    dateFrom: rawParams.dateFrom,
    dateTo: rawParams.dateTo,
  });

  const query = parsed.success ? parsed.data : auditLogListQuerySchema.parse({});
  const data = await listAuditLogs(query, { sessionUserFullName: actor.fullName });

  return (
    <AdminPageShell
      title="Audit Logs"
      description="Track member, welfare support, and system activity."
    >
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <AuditLogsTable data={data} />
      </Suspense>
    </AdminPageShell>
  );
}
