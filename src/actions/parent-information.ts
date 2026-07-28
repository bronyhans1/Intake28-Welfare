"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  overrideMemberParentInformation,
  saveMemberParentInformation,
} from "@/lib/parent-information/repository";
import { canManageMembers } from "@/lib/members/repository";
import {
  parentInformationFormSchema,
  parentInformationOverrideSchema,
  type ParentInformationFormSchemaInput,
  type ParentInformationOverrideSchemaInput,
} from "@/lib/validators/parent-information";
import { formatDisplayDate } from "@/lib/utils/format-date";

export type ParentInformationActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: boolean;
  successMessage?: string;
  lockedUntil?: string;
};

const SERVER_UNAVAILABLE =
  "Parent Information updates are temporarily unavailable. Please try again later.";

function flattenFieldErrors(
  fieldErrors: Record<string, string[] | undefined>,
): Record<string, string[] | undefined> {
  return fieldErrors;
}

export async function saveParentInformationAction(
  input: ParentInformationFormSchemaInput,
): Promise<ParentInformationActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    return { error: "You must be signed in to save Parent Information." };
  }

  if (!hasPermission(actor.role, Permission.UPDATE_PROFILE)) {
    return { error: "You do not have permission to update Parent Information." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  const parsed = parentInformationFormSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      error:
        flat.formErrors[0] ??
        "Please correct the Parent Information errors below.",
      fieldErrors: flattenFieldErrors(flat.fieldErrors),
    };
  }

  try {
    const result = await saveMemberParentInformation(
      actor.uid,
      parsed.data,
      actor,
    );
    const lockedUntilLabel = formatDisplayDate(result.lockedUntil);

    revalidatePath("/dashboard");
    revalidatePath("/portal/profile");
    revalidatePath("/portal/profile/edit");

    return {
      success: true,
      lockedUntil: result.lockedUntil.toISOString(),
      successMessage: [
        "✅ Parent Information saved successfully.",
        `Your Parent Information has been locked until ${lockedUntilLabel}.`,
        "If a correction is required before then, please contact the Welfare Administrator.",
      ].join("\n"),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to save Parent Information.",
    };
  }
}

export async function overrideParentInformationAction(
  memberId: string,
  input: ParentInformationOverrideSchemaInput,
): Promise<ParentInformationActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    return { error: "You must be signed in to override Parent Information." };
  }

  if (!canManageMembers(actor.role)) {
    return {
      error: "Only Welfare Administrators can override Parent Information.",
    };
  }

  if (!hasPermission(actor.role, Permission.EDIT_MEMBER)) {
    return {
      error: "You do not have permission to override Parent Information.",
    };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  const parsed = parentInformationOverrideSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      error:
        flat.formErrors[0] ??
        "Please correct the Parent Information errors below.",
      fieldErrors: flattenFieldErrors(flat.fieldErrors),
    };
  }

  try {
    await overrideMemberParentInformation(memberId, parsed.data, actor);

    revalidatePath("/dashboard");
    revalidatePath("/portal/profile");
    revalidatePath(`/admin/members/${memberId}`);
    revalidatePath("/admin/members");
    revalidatePath("/admin/audit-logs");

    return {
      success: true,
      successMessage: [
        "✅ Parent Information updated successfully.",
        "This override has been recorded in the audit history.",
      ].join("\n"),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to override Parent Information.",
    };
  }
}
