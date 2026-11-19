import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AdminBackLink,
  AdminBreadcrumb,
  AdminPageShell,
} from "@/components/admin/admin-page-shell";
import {
  ContributionSourceBadge,
  ContributionStatusBadge,
  ContributionTypeBadge,
} from "@/components/admin/contributions-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canManageContributions,
  canViewContributions,
  getContributionById,
} from "@/lib/contributions/repository";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/currency";
import { resolveContributionSource } from "@/lib/contributions/labels";
import { ContributionSource } from "@/types/enums";
import { Pencil } from "lucide-react";

export const metadata = createPageMetadata(
  "Contribution Record",
  "View contribution record details",
);

interface ContributionDetailPageProps {
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

export default async function ContributionDetailPage({
  params,
}: ContributionDetailPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewContributions(actor.role)) {
    redirect("/admin/dashboard");
  }

  const { id } = await params;
  const record = await getContributionById(id);

  if (!record) {
    notFound();
  }

  const canManage = canManageContributions(actor.role);
  const source = resolveContributionSource(record.source);

  return (
    <AdminPageShell
      title="Contribution Record"
      description="Full details for this contribution entry."
      action={
        canManage ? (
          <Link
            href={`/admin/contributions/${record.id}/edit`}
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
          { label: "Contributions", href: "/admin/contributions" },
          { label: record.memberName },
        ]}
      />
      <AdminBackLink href="/admin/contributions" label="Back to contributions" />

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Contribution Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="Member" value={record.memberName} />
            <DetailItem label="Service Number" value={record.serviceNumber} />
            <DetailItem
              label="Contribution Type"
              value={<ContributionTypeBadge contributionType={record.contributionType} />}
            />
            <DetailItem
              label="Amount"
              value={
                <span className="font-semibold text-[#166534]">
                  {formatCurrency(record.amount)}
                </span>
              }
            />
            <DetailItem label="Month" value={record.month} />
            <DetailItem label="Year" value={record.year} />
            <DetailItem
              label="Status"
              value={<ContributionStatusBadge status={record.status} />}
            />
            <DetailItem
              label="Source"
              value={<ContributionSourceBadge source={source} />}
            />
            {source === ContributionSource.PAYSTACK && record.paymentReference ? (
              <DetailItem label="Payment Reference" value={record.paymentReference} />
            ) : null}
            {source === ContributionSource.MANUAL ? (
              <DetailItem label="Recorded By" value={record.recordedByName} />
            ) : null}
            <DetailItem
              label="Created Date"
              value={formatDisplayDate(record.createdAt)}
            />
          </dl>
        </CardContent>
      </Card>

      {record.remarks ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{record.remarks}</p>
          </CardContent>
        </Card>
      ) : null}
    </AdminPageShell>
  );
}

