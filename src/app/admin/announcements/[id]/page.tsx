import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AdminBackLink,
  AdminBreadcrumb,
  AdminPageShell,
} from "@/components/admin/admin-page-shell";
import {
  AnnouncementAudienceBadge,
  AnnouncementStatusBadge,
} from "@/components/admin/announcements-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canManageAnnouncements,
  canViewAnnouncements,
  getAnnouncementById,
} from "@/lib/announcements/repository";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { Pencil } from "lucide-react";

export const metadata = createPageMetadata(
  "Announcement",
  "View announcement details",
);

interface AnnouncementDetailPageProps {
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

export default async function AnnouncementDetailPage({
  params,
}: AnnouncementDetailPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewAnnouncements(actor.role)) {
    redirect("/admin/dashboard");
  }

  const { id } = await params;
  const record = await getAnnouncementById(id);

  if (!record) {
    notFound();
  }

  const canManage = canManageAnnouncements(actor.role);

  return (
    <AdminPageShell
      title="Announcement"
      description="Announcement details and publication status."
      action={
        canManage ? (
          <Link
            href={`/admin/announcements/${record.id}/edit`}
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
          { label: "Announcements", href: "/admin/announcements" },
          { label: record.title },
        ]}
      />
      <AdminBackLink href="/admin/announcements" label="Back to announcements" />

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>{record.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="whitespace-pre-wrap text-sm text-foreground">{record.message}</p>
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailItem
              label="Audience"
              value={<AnnouncementAudienceBadge audience={record.audience} />}
            />
            <DetailItem
              label="Status"
              value={<AnnouncementStatusBadge status={record.status} />}
            />
            <DetailItem
              label="Published Date"
              value={record.publishedAt ? formatDisplayDate(record.publishedAt) : "—"}
            />
            <DetailItem label="Created By" value={record.createdByName} />
            <DetailItem
              label="Created Date"
              value={formatDisplayDate(record.createdAt)}
            />
            <DetailItem
              label="Expires At"
              value={record.expiresAt ? formatDisplayDate(record.expiresAt) : "—"}
            />
          </dl>
        </CardContent>
      </Card>
    </AdminPageShell>
  );
}
