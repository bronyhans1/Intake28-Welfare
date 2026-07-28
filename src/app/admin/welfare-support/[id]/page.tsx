import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AdminBackLink,
  AdminBreadcrumb,
  AdminPageShell,
} from "@/components/admin/admin-page-shell";
import {
  SupportStatusBadge,
  SupportTypeBadge,
} from "@/components/admin/welfare-support-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canManageWelfareSupport,
  canViewWelfareSupport,
  getWelfareSupportById,
} from "@/lib/welfare/repository";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/currency";
import { Pencil } from "lucide-react";

export const metadata = createPageMetadata(
  "Welfare Support Record",
  "View welfare support record details",
);

interface WelfareSupportDetailPageProps {
  params: Promise<{ id: string }>;
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value ?? "—"}</dd>
    </div>
  );
}

export default async function WelfareSupportDetailPage({
  params,
}: WelfareSupportDetailPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewWelfareSupport(actor.role)) {
    redirect("/admin/dashboard");
  }

  const { id } = await params;
  const record = await getWelfareSupportById(id);

  if (!record) {
    notFound();
  }

  const canManage = canManageWelfareSupport(actor.role);

  return (
    <AdminPageShell
      title="Welfare Support Record"
      description="Full details for this welfare support entry."
      action={
        canManage ? (
          <Link
            href={`/admin/welfare-support/${record.id}/edit`}
            className={buttonVariants({
              className: "bg-[#166534] text-white hover:bg-[#14532d]",
            })}
          >
            <Pencil className="mr-1.5 size-4" />
            Edit
          </Link>
        ) : null
      }
    >
      <AdminBreadcrumb
        items={[
          { label: "Welfare Support", href: "/admin/welfare-support" },
          { label: record.memberName },
        ]}
      />
      <AdminBackLink href="/admin/welfare-support" label="Back to welfare support" />

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Support Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="Member" value={record.memberName} />
            <DetailItem label="Service Number" value={record.serviceNumber} />
            <DetailItem
              label="Support Type"
              value={<SupportTypeBadge supportType={record.supportType} />}
            />
            <DetailItem
              label="Amount"
              value={
                <span className="font-semibold text-[#166534]">
                  {formatCurrency(record.amount)}
                </span>
              }
            />
            <DetailItem
              label="Status"
              value={<SupportStatusBadge status={record.status} />}
            />
            <DetailItem label="Approved By" value={record.approvedByName} />
            <DetailItem label="Recorded By" value={record.recordedByName} />
            <DetailItem
              label="Created Date"
              value={formatDisplayDate(record.createdAt)}
            />
          </dl>
        </CardContent>
      </Card>

      {record.description ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{record.description}</p>
          </CardContent>
        </Card>
      ) : null}
    </AdminPageShell>
  );
}
