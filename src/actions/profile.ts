"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { assertProfilePhotoPathOwnership, isProfilePhotoStorageEnabled } from "@/lib/storage/profile-photo";
import { getMemberById, removeMemberProfilePhoto, updateMemberProfile, updateMemberProfilePhoto } from "@/lib/members/repository";
import {
  profilePhotoUpdateSchema,
  updateProfileSchema,
  type ProfilePhotoUpdateInput,
  type UpdateProfileFormInput,
} from "@/lib/validators/profile";

export type ProfileActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: boolean;
};

const SERVER_UNAVAILABLE =
  "Profile updates are temporarily unavailable. Please try again later.";

export async function fetchOwnProfile() {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    return { error: "You must be signed in to view your profile." };
  }

  if (!hasPermission(actor.role, Permission.UPDATE_PROFILE)) {
    return { error: "You do not have permission to view this profile." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  try {
    const member = await getMemberById(actor.uid);
    if (!member) {
      return { error: "Profile not found." };
    }

    return { success: true as const, data: member };
  } catch {
    return { error: "Failed to load profile." };
  }
}

export async function updateProfileAction(
  input: UpdateProfileFormInput,
): Promise<ProfileActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    return { error: "You must be signed in to update your profile." };
  }

  if (!hasPermission(actor.role, Permission.UPDATE_PROFILE)) {
    return { error: "You do not have permission to update your profile." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateMemberProfile(actor.uid, parsed.data, actor);
    revalidatePath("/dashboard");
    revalidatePath("/portal/profile");
    revalidatePath("/portal/profile/edit");
    redirect("/portal/profile?toast=profile-updated");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      error: error instanceof Error ? error.message : "Failed to update profile.",
    };
  }
}

export async function updateProfilePhotoAction(
  input: ProfilePhotoUpdateInput,
): Promise<ProfileActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    return { error: "You must be signed in to update your profile photo." };
  }

  if (!hasPermission(actor.role, Permission.UPLOAD_PROFILE_PHOTO)) {
    return { error: "You do not have permission to update your profile photo." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  if (!isProfilePhotoStorageEnabled()) {
    return { error: "Profile photo uploads are temporarily unavailable." };
  }

  const parsed = profilePhotoUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid profile photo upload." };
  }

  try {
    assertProfilePhotoPathOwnership(parsed.data.profilePhotoPath, actor.serviceNumber);
    await updateMemberProfilePhoto(actor.uid, parsed.data, actor);
    revalidatePath("/dashboard");
    revalidatePath("/portal/profile");
    revalidatePath("/portal/profile/edit");
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update profile photo.",
    };
  }
}

export async function removeProfilePhotoAction(): Promise<ProfileActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    return { error: "You must be signed in to remove your profile photo." };
  }

  if (!hasPermission(actor.role, Permission.UPLOAD_PROFILE_PHOTO)) {
    return { error: "You do not have permission to update your profile photo." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  try {
    await removeMemberProfilePhoto(actor.uid, actor);
    revalidatePath("/dashboard");
    revalidatePath("/portal/profile");
    revalidatePath("/portal/profile/edit");
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to remove profile photo.",
    };
  }
}
