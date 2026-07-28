import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminBackLink, AdminBreadcrumb, AdminPageShell } from "@/components/admin/admin-page-shell";
import { MemberAvatar } from "@/components/admin/member-avatar";
import {
  ActivationBadge,
  RoleBadge,
  StatusBadge,
} from "@/components/admin/member-badges";
import { ParentInformationCard } from "@/components/member/parent-information-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canManageMembers,
  canViewMembers,
  getMemberById,
} from "@/lib/members/repository";
import { getProgressionByMemberId } from "@/lib/progression/repository";
import {
  formatOutstandingMonthsDisplay,
  resolveOutstandingBalance,
} from "@/lib/progression/outstanding-display";
import { formatMonthYearLabel } from "@/lib/finance/period";
import { getMonthlyDuesAmount } from "@/lib/system-settings/repository";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { formatGenderLabel } from "@/lib/utils/gender";
import {
  MEMBERSHIP_PROGRESSION_STATUS_LABELS,
  MembershipProgressionStatus,
} from "@/types/enums";

export const metadata = createPageMetadata(
  "Member Details",
  "View GIS welfare member details",
);

interface MemberDetailPageProps {
  params: Promise<{ id: string }>;
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

export default async function MemberDetailPage({ params }: MemberDetailPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewMembers(actor.role)) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const [member, progression, monthlyDuesAmount] = await Promise.all([
    getMemberById(id),
    getProgressionByMemberId(id),
    getMonthlyDuesAmount(),
  ]);

  if (!member) {
    notFound();
  }

  const canManage = canManageMembers(actor.role);
  const outstandingMonths = progression?.outstandingMonths ?? [];
  const outstandingLabels = outstandingMonths.map((period) =>
    formatMonthYearLabel(period),
  );
  const monthsOwing =
    progression?.outstandingContributionMonths ?? outstandingLabels.length;
  const outstandingBalance = resolveOutstandingBalance(
    monthsOwing,
    monthlyDuesAmount,
  );
  const outstandingDisplay = formatOutstandingMonthsDisplay(outstandingLabels);

  return (
    <AdminPageShell
      title={member.fullName}
      description={member.serviceNumber}
      action={
        canManage ? (
          <Link
            href={`/admin/members/${member.id}/edit`}
            className={buttonVariants({ variant: "outline" })}
          >
            Edit Member
          </Link>
        ) : null
      }
    >
      <AdminBreadcrumb
        items={[
          { label: "Members", href: "/admin/members" },
          { label: member.fullName },
        ]}
      />
      <AdminBackLink href="/admin/members" label="Back to members" />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
            <MemberAvatar
              fullName={member.fullName}
              profilePhotoUrl={member.profilePhotoUrl}
              className="size-24"
            />
            <div>
              <p className="text-lg font-semibold">{member.fullName}</p>
              <p className="text-sm text-muted-foreground">{member.serviceNumber}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <RoleBadge role={member.role} />
              <StatusBadge status={member.status} />
              <ActivationBadge activationStatus={member.activationStatus} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Member Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailItem label="Service Number" value={member.serviceNumber} />
                <DetailItem label="Phone Number" value={member.phoneNumber} />
                <DetailItem label="Email" value={member.email || "—"} />
                <DetailItem
                  label="Date Of Birth"
                  value={formatDisplayDate(member.dateOfBirth)}
                />
                <DetailItem label="Gender" value={formatGenderLabel(member.gender)} />
                <DetailItem label="Rank" value={member.rank} />
                <DetailItem label="Station" value={member.station} />
                <DetailItem label="Role" value={<RoleBadge role={member.role} />} />
                <DetailItem label="Status" value={<StatusBadge status={member.status} />} />
                <DetailItem
                  label="Activation Status"
                  value={<ActivationBadge activationStatus={member.activationStatus} />}
                />
                <DetailItem
                  label="Profile Photo Updated"
                  value={formatDisplayDate(member.profilePhotoUpdatedAt)}
                />
                <DetailItem
                  label="Last Profile Update"
                  value={formatDisplayDate(member.updatedAt)}
                />
                <DetailItem
                  label="Profile Completion"
                  value={`${member.profileCompletionPercentage}%`}
                />
                <DetailItem
                  label="Created Date"
                  value={formatDisplayDate(member.createdAt)}
                />
                <DetailItem label="Beneficiary / Next of Kin" value={member.nextOfKin || "—"} />
                <DetailItem
                  label="Emergency Contact"
                  value={member.emergencyContact || "—"}
                />
              </dl>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Membership Progression</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {progression ? (
                <>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <DetailItem
                      label="Membership Status"
                      value={
                        MEMBERSHIP_PROGRESSION_STATUS_LABELS[
                          progression.membershipStatus as MembershipProgressionStatus
                        ] ?? progression.membershipStatus
                      }
                    />
                    <DetailItem
                      label="Welfare Points"
                      value={progression.welfarePoints}
                    />
                    <DetailItem
                      label="Benefit Percentage"
                      value={`${progression.benefitPercentage}%`}
                    />
                    <DetailItem label="Months Owing" value={monthsOwing} />
                    <DetailItem
                      label="Outstanding Balance"
                      value={formatCurrency(outstandingBalance)}
                    />
                  </dl>
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Outstanding Months
                    </p>
                    {outstandingLabels.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No outstanding monthly contributions.
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-foreground">
                        {outstandingDisplay}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Progression has not been calculated for this member yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Recent Audit Events</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Audit event history will appear here once the audit log viewer is
                connected. Member actions are already recorded in the audit_logs
                collection.
              </p>
            </CardContent>
          </Card>

          {canManage ? (
            <ParentInformationCard member={member} mode="admin" />
          ) : (
            <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
              <CardHeader>
                <CardTitle>Parent Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <DetailItem
                    label="Mother"
                    value={
                      member.motherFullName
                        ? `${member.motherFullName} (${member.motherStatus === "deceased" ? "Deceased" : member.motherStatus === "alive" ? "Alive" : "—"})`
                        : "—"
                    }
                  />
                  <DetailItem
                    label="Father"
                    value={
                      member.fatherFullName
                        ? `${member.fatherFullName} (${member.fatherStatus === "deceased" ? "Deceased" : member.fatherStatus === "alive" ? "Alive" : "—"})`
                        : "—"
                    }
                  />
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminPageShell>
  );
}
