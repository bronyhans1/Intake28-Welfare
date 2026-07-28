"use server";

import { revalidatePath } from "next/cache";
import {
  canManageSettings,
  updateSystemSettings,
} from "@/lib/system-settings/repository";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { updateSystemSettingsSchema } from "@/lib/validators/settings";
import type { CurrentUser } from "@/types/auth";

export type SettingsActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: boolean;
};

const SERVER_UNAVAILABLE =
  "Settings management is temporarily unavailable. Please try again later.";

async function requireManageAccess(): Promise<CurrentUser | SettingsActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canManageSettings(actor.role)) {
    return { error: "You do not have permission to manage settings." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  return actor;
}

function isActor(
  result: CurrentUser | SettingsActionState,
): result is CurrentUser {
  return "uid" in result;
}

export async function updateSettingsAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const access = await requireManageAccess();
  if (!isActor(access)) return access;

  const parsed = updateSystemSettingsSchema.safeParse({
    organizationName: formData.get("organizationName"),
    portalName: formData.get("portalName"),
    supportEmail: formData.get("supportEmail")?.toString() ?? "",
    supportPhone: formData.get("supportPhone") || undefined,
    monthlyDuesAmount: formData.get("monthlyDuesAmount"),
    currency: formData.get("currency"),
    defaultAnnouncementExpiryDays: formData.get("defaultAnnouncementExpiryDays"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await updateSystemSettings(parsed.data, access);
    revalidatePath("/admin/settings");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/contributions/new");
    return { success: true };
  } catch {
    return { error: "Failed to save settings." };
  }
}
