"use client";

import { useState, useTransition } from "react";
import { useForm, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { createMemberAction, updateMemberAction } from "@/actions/members";
import { ServiceNumberInput } from "@/components/forms/service-number-input";
import { Button } from "@/components/ui/button";
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
import {
  createMemberSchema,
  updateMemberSchema,
  type CreateMemberFormInput,
  type UpdateMemberFormInput,
} from "@/lib/validators/member";
import { formatInputDate } from "@/lib/utils/format-date";
import { Gender, UserRole, UserStatus } from "@/types/enums";
import type { SerializedMember } from "@/types/user";

interface MemberFormProps {
  mode: "create" | "edit";
  member?: SerializedMember;
}

export function CreateMemberForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<CreateMemberFormInput>({
    resolver: zodResolver(createMemberSchema),
    defaultValues: {
      serviceNumberSuffix: "",
      fullName: "",
      phoneNumber: "",
      dateOfBirth: "",
      gender: undefined,
      rank: "",
      station: "",
      role: UserRole.MEMBER,
      nextOfKin: "",
      emergencyContact: "",
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = form;

  function onSubmit(values: CreateMemberFormInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await createMemberAction(values);
      if (result?.error) setServerError(result.error);
    });
  }

  return (
    <MemberFormShell
      isPending={isPending}
      serverError={serverError}
      isCreate
      onSubmit={handleSubmit(onSubmit)}
      errors={errors}
      register={
        register as UseFormRegister<CreateMemberFormInput | UpdateMemberFormInput>
      }
      roleValue={watch("role")}
      genderValue={watch("gender")}
      onRoleChange={(value) => setValue("role", value, { shouldValidate: true })}
      onGenderChange={(value) =>
        setValue(
          "gender",
          value === "unset" ? undefined : (value as Gender),
          { shouldValidate: true },
        )
      }
    />
  );
}

export function EditMemberForm({ member }: { member: SerializedMember }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateMemberFormInput>({
    resolver: zodResolver(updateMemberSchema),
    defaultValues: {
      fullName: member.fullName,
      phoneNumber: member.phoneNumber,
      dateOfBirth: formatInputDate(member.dateOfBirth),
      gender: member.gender ?? undefined,
      rank: member.rank ?? "",
      station: member.station ?? "",
      role: member.role,
      status: member.status,
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

  function onSubmit(values: UpdateMemberFormInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateMemberAction(member.id, values);
      if (result?.error) setServerError(result.error);
    });
  }

  return (
    <MemberFormShell
      isPending={isPending}
      serverError={serverError}
      isCreate={false}
      member={member}
      onSubmit={handleSubmit(onSubmit)}
      errors={errors}
      register={
        register as UseFormRegister<CreateMemberFormInput | UpdateMemberFormInput>
      }
      roleValue={watch("role")}
      statusValue={watch("status")}
      genderValue={watch("gender")}
      onRoleChange={(value) => setValue("role", value, { shouldValidate: true })}
      onStatusChange={(value) => setValue("status", value, { shouldValidate: true })}
      onGenderChange={(value) =>
        setValue(
          "gender",
          value === "unset" ? undefined : (value as Gender),
          { shouldValidate: true },
        )
      }
    />
  );
}

interface MemberFormShellProps {
  isPending: boolean;
  serverError: string | null;
  isCreate: boolean;
  member?: SerializedMember;
  onSubmit: () => void;
  errors: Record<string, { message?: string } | undefined>;
  register: UseFormRegister<CreateMemberFormInput | UpdateMemberFormInput>;
  roleValue: UserRole;
  statusValue?: UserStatus;
  genderValue?: Gender | "" | null;
  onRoleChange: (value: UserRole) => void;
  onStatusChange?: (value: UserStatus) => void;
  onGenderChange: (value: Gender | "unset") => void;
}

function MemberFormShell({
  isPending,
  serverError,
  isCreate,
  member,
  onSubmit,
  errors,
  register,
  roleValue,
  statusValue,
  genderValue,
  onRoleChange,
  onStatusChange,
  onGenderChange,
}: MemberFormShellProps) {
  return (
    <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-6">
            {isCreate ? (
              <Field data-invalid={!!errors.serviceNumberSuffix}>
                <FieldLabel htmlFor="serviceNumberSuffix">Service Number</FieldLabel>
                <ServiceNumberInput
                  id="serviceNumberSuffix"
                  invalid={!!errors.serviceNumberSuffix}
                  disabled={isPending}
                  {...register("serviceNumberSuffix")}
                />
                <FieldError errors={[errors.serviceNumberSuffix]} />
              </Field>
            ) : (
              <Field>
                <FieldLabel>Service Number</FieldLabel>
                <Input value={member?.serviceNumber} disabled readOnly />
              </Field>
            )}

            <div className="grid gap-6 sm:grid-cols-2">
              <Field data-invalid={!!errors.fullName}>
                <FieldLabel htmlFor="fullName">Full Name</FieldLabel>
                <Input id="fullName" disabled={isPending} {...register("fullName")} />
                <FieldError errors={[errors.fullName]} />
              </Field>

              <Field data-invalid={!!errors.phoneNumber}>
                <FieldLabel htmlFor="phoneNumber">Phone Number</FieldLabel>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="024XXXXXXX"
                  disabled={isPending}
                  {...register("phoneNumber")}
                />
                <FieldError errors={[errors.phoneNumber]} />
              </Field>

              <Field data-invalid={!!errors.dateOfBirth}>
                <FieldLabel htmlFor="dateOfBirth">
                  {isCreate ? "Date Of Birth (optional)" : "Date Of Birth"}
                </FieldLabel>
                <Input
                  id="dateOfBirth"
                  type="date"
                  disabled={isPending}
                  {...register("dateOfBirth")}
                />
                <FieldError errors={[errors.dateOfBirth]} />
              </Field>

              <Field data-invalid={!!errors.gender}>
                <FieldLabel>Gender{isCreate ? " (optional)" : ""}</FieldLabel>
                <Select
                  value={genderValue ?? "unset"}
                  onValueChange={(value) =>
                    onGenderChange(value as Gender | "unset")
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
                <FieldLabel htmlFor="rank">
                  {isCreate ? "Rank (optional)" : "Rank"}
                </FieldLabel>
                <Input id="rank" disabled={isPending} {...register("rank")} />
                <FieldError errors={[errors.rank]} />
              </Field>

              <Field data-invalid={!!errors.station}>
                <FieldLabel htmlFor="station">
                  {isCreate ? "Station (optional)" : "Station"}
                </FieldLabel>
                <Input id="station" disabled={isPending} {...register("station")} />
                <FieldError errors={[errors.station]} />
              </Field>

              <Field data-invalid={!!errors.role}>
                <FieldLabel>Role</FieldLabel>
                <Select
                  value={roleValue}
                  onValueChange={(value) => onRoleChange(value as UserRole)}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UserRole.MEMBER}>Member</SelectItem>
                    <SelectItem value={UserRole.TREASURER}>Treasurer</SelectItem>
                    <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError errors={[errors.role]} />
              </Field>

              {!isCreate && statusValue && onStatusChange ? (
                <Field data-invalid={!!errors.status}>
                  <FieldLabel>Status</FieldLabel>
                  <Select
                    value={statusValue}
                    onValueChange={(value) => onStatusChange(value as UserStatus)}
                    disabled={isPending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UserStatus.ACTIVE}>Active</SelectItem>
                      <SelectItem value={UserStatus.INACTIVE}>Inactive</SelectItem>
                      <SelectItem value={UserStatus.SUSPENDED}>Suspended</SelectItem>
                      <SelectItem value={UserStatus.DEACTIVATED}>Deactivated</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError errors={[errors.status]} />
                </Field>
              ) : null}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="nextOfKin">Beneficiary / Next of Kin (optional)</FieldLabel>
                <Input id="nextOfKin" disabled={isPending} {...register("nextOfKin")} />
              </Field>

              <Field>
                <FieldLabel htmlFor="emergencyContact">
                  Emergency Contact (optional)
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

            <Button
              type="submit"
              className="h-11 bg-[#166534] hover:bg-[#14532d]"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving…
                </>
              ) : isCreate ? (
                "Create Member"
              ) : (
                "Save Changes"
              )}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

export function MemberForm({ mode, member }: MemberFormProps) {
  if (mode === "create") return <CreateMemberForm />;
  if (!member) return null;
  return <EditMemberForm member={member} />;
}
