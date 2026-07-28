"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canManageAnnouncements,
  canViewAnnouncements,
  createAnnouncement,
  updateAnnouncement,
} from "@/lib/announcements/repository";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from "@/lib/validators/announcements";
import type { CurrentUser } from "@/types/auth";

export type AnnouncementsActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: boolean;
};

const SERVER_UNAVAILABLE =
  "Announcements management is temporarily unavailable. Please try again later.";

async function requireManageAccess(): Promise<CurrentUser | AnnouncementsActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canManageAnnouncements(actor.role)) {
    return { error: "You do not have permission to manage announcements." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  return actor;
}

function isActor(
  result: CurrentUser | AnnouncementsActionState,
): result is CurrentUser {
  return "uid" in result;
}

export async function createAnnouncementAction(
  _prevState: AnnouncementsActionState,
  formData: FormData,
): Promise<AnnouncementsActionState> {
  const access = await requireManageAccess();
  if (!isActor(access)) return access;

  const parsed = createAnnouncementSchema.safeParse({
    title: formData.get("title"),
    message: formData.get("message"),
    audience: formData.get("audience"),
    status: formData.get("status") || undefined,
    publishNow: formData.get("publishNow") === "true",
    expiresAt: formData.get("expiresAt") || null,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const { recordId } = await createAnnouncement(parsed.data, access);
    revalidatePath("/admin/announcements");
    revalidatePath("/portal/announcements");
    revalidatePath("/dashboard");
    revalidatePath("/admin/dashboard");
    redirect(`/admin/announcements/${recordId}?toast=announcement-created`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: "Failed to create announcement." };
  }
}

export async function updateAnnouncementAction(
  recordId: string,
  _prevState: AnnouncementsActionState,
  formData: FormData,
): Promise<AnnouncementsActionState> {
  const access = await requireManageAccess();
  if (!isActor(access)) return access;

  const parsed = updateAnnouncementSchema.safeParse({
    title: formData.get("title"),
    message: formData.get("message"),
    audience: formData.get("audience"),
    status: formData.get("status"),
    expiresAt: formData.get("expiresAt") || null,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await updateAnnouncement(recordId, parsed.data, access);
    revalidatePath("/admin/announcements");
    revalidatePath(`/admin/announcements/${recordId}`);
    revalidatePath("/portal/announcements");
    revalidatePath("/dashboard");
    revalidatePath("/admin/dashboard");
    redirect(`/admin/announcements/${recordId}?toast=announcement-updated`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      error:
        error instanceof Error ? error.message : "Failed to update announcement.",
    };
  }
}

export async function canAccessAnnouncementsManagement(role: CurrentUser["role"]) {
  return canManageAnnouncements(role);
}

export async function canAccessAnnouncementsView(role: CurrentUser["role"]) {
  return canViewAnnouncements(role);
}
