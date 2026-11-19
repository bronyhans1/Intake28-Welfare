import Link from "next/link";
import { ProfilePhotoManager } from "@/components/member/profile-photo-manager";
import { ParentInformationCard } from "@/components/member/parent-information-card";
import { MemberPageShell } from "@/components/member/member-page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { formatGenderLabel } from "@/lib/utils/gender";
import { isProfilePhotoStorageEnabled } from "@/lib/storage/profile-photo";
import type { SerializedMember } from "@/types/user";

interface MemberProfileViewProps {
  member: SerializedMember;
  photoStorageEnabled?: boolean;
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

export function MemberProfileView({
  member,
  photoStorageEnabled = isProfilePhotoStorageEnabled(),
}: MemberProfileViewProps) {
  return (
    <MemberPageShell
      title="My Profile"
      description="View your welfare portal profile information."
      action={
        <Link
          href="/portal/profile/edit"
          className={buttonVariants({
            className: "bg-[#166534] text-white hover:bg-[#14532d]",
          })}
        >
          Edit Profile
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardContent className="pt-6">
            <ProfilePhotoManager
              memberId={member.id}
              serviceNumber={member.serviceNumber}
              fullName={member.fullName}
              profilePhotoUrl={member.profilePhotoUrl}
              profilePhotoPath={member.profilePhotoPath}
              storageEnabled={photoStorageEnabled}
            />
            <p className="mt-4 text-sm font-medium text-[#166534]">
              {member.profileCompletionPercentage}% complete
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="Service Number" value={member.serviceNumber} />
              <DetailItem label="Full Name" value={member.fullName} />
              <DetailItem
                label="Gender"
                value={formatGenderLabel(member.gender)}
              />
              <DetailItem label="Phone Number" value={member.phoneNumber} />
              <DetailItem label="Email" value={member.email || "—"} />
              <DetailItem
                label="Date Of Birth"
                value={formatDisplayDate(member.dateOfBirth)}
              />
              <DetailItem label="Rank" value={member.rank || "—"} />
              <DetailItem label="Station" value={member.station || "—"} />
              <DetailItem label="Beneficiary / Next of Kin" value={member.nextOfKin || "—"} />
              <DetailItem
                label="Emergency Contact"
                value={member.emergencyContact || "—"}
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
            </dl>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <ParentInformationCard member={member} mode="member" />
        </div>
      </div>
    </MemberPageShell>
  );
}
