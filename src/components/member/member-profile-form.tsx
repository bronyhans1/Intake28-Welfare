"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateProfileAction } from "@/actions/profile";
import { MemberBackLink, MemberPageShell } from "@/components/member/member-page-shell";
import { ProfilePhotoManager } from "@/components/member/profile-photo-manager";
import { PhoneVerificationPanel } from "@/components/member/phone-verification-panel";
import { LoadingButton } from "@/components/ui/loading-button";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatInputDate } from "@/lib/utils/format-date";
import {
  updateProfileSchema,
  type UpdateProfileFormInput,
} from "@/lib/validators/profile";
import { isProfilePhotoStorageEnabled } from "@/lib/storage/profile-photo";
import { Gender } from "@/types/enums";
import type { SerializedMember } from "@/types/user";

interface MemberProfileFormProps {
  member: SerializedMember;
  photoStorageEnabled?: boolean;
}

export function MemberProfileForm({
  member,
  photoStorageEnabled = isProfilePhotoStorageEnabled(),
}: MemberProfileFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [displayPhone, setDisplayPhone] = useState(member.phoneNumber);
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateProfileFormInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      email: member.email ?? "",
      dateOfBirth: formatInputDate(member.dateOfBirth),
      gender: member.gender ?? undefined,
      rank: member.rank ?? "",
      station: member.station ?? "",
      nextOfKin: member.nextOfKin ?? "",
      emergencyContact: member.emergencyContact ?? "",
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = form;

  function onSubmit(values: UpdateProfileFormInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateProfileAction(values);
      if (result?.error) setServerError(result.error);
    });
  }

  return (
    <MemberPageShell
      title="Edit Profile"
      description="Update your contact and service profile details."
    >
      <LoadingOverlay
        open={isPending}
        title="Saving profile…"
        message="Please wait."
      />

      <MemberBackLink href="/portal/profile" label="Back to profile" />

      <Card className="mb-6 rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardContent className="pt-6">
          <ProfilePhotoManager
            memberId={member.id}
            serviceNumber={member.serviceNumber}
            fullName={member.fullName}
            profilePhotoUrl={member.profilePhotoUrl}
            profilePhotoPath={member.profilePhotoPath}
            storageEnabled={photoStorageEnabled}
          />
        </CardContent>
      </Card>

      <Card className="mb-6 rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardContent className="pt-6">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Phone Number</h3>
          <PhoneVerificationPanel
            currentPhone={displayPhone}
            onVerified={setDisplayPhone}
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <FieldGroup className="gap-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Service Number</FieldLabel>
                  <Input value={member.serviceNumber} disabled readOnly />
                </Field>

                <Field>
                  <FieldLabel>Full Name</FieldLabel>
                  <Input value={member.fullName} disabled readOnly />
                </Field>

                <Field data-invalid={!!errors.email}>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    disabled={isPending}
                    {...register("email")}
                  />
                  <FieldError errors={[errors.email]} />
                </Field>

                <Field data-invalid={!!errors.dateOfBirth}>
                  <FieldLabel htmlFor="dateOfBirth">Date Of Birth</FieldLabel>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    disabled={isPending}
                    {...register("dateOfBirth")}
                  />
                  <FieldError errors={[errors.dateOfBirth]} />
                </Field>

                <Field data-invalid={!!errors.gender}>
                  <FieldLabel>Gender</FieldLabel>
                  <Select
                    value={watch("gender") ?? "unset"}
                    onValueChange={(value) =>
                      setValue(
                        "gender",
                        value === "unset" ? undefined : (value as Gender),
                        { shouldValidate: true },
                      )
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Select Gender</SelectItem>
                      <SelectItem value={Gender.MALE}>Male</SelectItem>
                      <SelectItem value={Gender.FEMALE}>Female</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError errors={[errors.gender]} />
                </Field>

                <Field data-invalid={!!errors.rank}>
                  <FieldLabel htmlFor="rank">Rank</FieldLabel>
                  <Input id="rank" disabled={isPending} {...register("rank")} />
                  <FieldError errors={[errors.rank]} />
                </Field>

                <Field data-invalid={!!errors.station}>
                  <FieldLabel htmlFor="station">Station</FieldLabel>
                  <Input
                    id="station"
                    disabled={isPending}
                    {...register("station")}
                  />
                  <FieldError errors={[errors.station]} />
                </Field>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="nextOfKin">Beneficiary / Next of Kin</FieldLabel>
                  <Input
                    id="nextOfKin"
                    disabled={isPending}
                    {...register("nextOfKin")}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="emergencyContact">
                    Emergency Contact
                  </FieldLabel>
                  <Input
                    id="emergencyContact"
                    disabled={isPending}
                    {...register("emergencyContact")}
                  />
                </Field>
              </div>

              {serverError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                >
                  {serverError}
                </div>
              ) : null}

              <LoadingButton
                type="submit"
                className="h-11 bg-[#166534] hover:bg-[#14532d]"
                loading={isPending}
                loadingText="Saving…"
              >
                Save Changes
              </LoadingButton>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </MemberPageShell>
  );
}
