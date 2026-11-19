"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  canManageWelfareSupport,
  canViewWelfareSupport,
  createWelfareSupport,
  getWelfareSupportById,
  listWelfareSupport,
  updateWelfareSupport,
} from "@/lib/welfare/repository";
import {
  createWelfareSupportSchema,
  updateWelfareSupportSchema,
  welfareSupportListQuerySchema,
} from "@/lib/validators/welfare-support";
import type {
  CreateWelfareSupportInput,
  UpdateWelfareSupportInput,
  WelfareSupportListQuery,
} from "@/lib/validators/welfare-support";
import type { CurrentUser } from "@/types/auth";

export type WelfareSupportActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: boolean;
};

const SERVER_UNAVAILABLE =
  "Welfare support management is temporarily unavailable. Please try again later.";

async function requireViewAccess(): Promise<CurrentUser | WelfareSupportActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewWelfareSupport(actor.role)) {
    return { error: "You do not have permission to view welfare support records." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  return actor;
}

async function requireManageAccess(): Promise<CurrentUser | WelfareSupportActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canManageWelfareSupport(actor.role)) {
    return { error: "You do not have permission to manage welfare support records." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  return actor;
}

function isActor(
  result: CurrentUser | WelfareSupportActionState,
): result is CurrentUser {
  return "uid" in result;
}

export async function fetchWelfareSupportList(query: WelfareSupportListQuery) {
  const access = await requireViewAccess();
  if (!isActor(access)) return access;

  const parsed = welfareSupportListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return { error: "Invalid query parameters." };
  }

  try {
    return { success: true as const, data: await listWelfareSupport(parsed.data) };
  } catch {
    return { error: "Failed to load welfare support records." };
  }
}

export async function fetchWelfareSupportRecord(recordId: string) {
  const access = await requireViewAccess();
  if (!isActor(access)) return access;

  try {
    const record = await getWelfareSupportById(recordId);
    if (!record) return { error: "Welfare support record not found." };
    return {
      success: true as const,
      data: record,
      canManage: canManageWelfareSupport(access.role),
    };
  } catch {
    return { error: "Failed to load welfare support record." };
  }
}

export async function createWelfareSupportAction(
  input: CreateWelfareSupportInput,
): Promise<WelfareSupportActionState> {
  const access = await requireManageAccess();
  if (!isActor(access)) return access;

  const parsed = createWelfareSupportSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { recordId } = await createWelfareSupport(parsed.data, access);
    revalidatePath("/admin/welfare-support");
    redirect(`/admin/welfare-support/${recordId}?toast=welfare-support-created`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      error: error instanceof Error ? error.message : "Failed to create welfare support record.",
    };
  }
}

export async function updateWelfareSupportAction(
  recordId: string,
  input: UpdateWelfareSupportInput,
): Promise<WelfareSupportActionState> {
  const access = await requireManageAccess();
  if (!isActor(access)) return access;

  if (!hasPermission(access.role, Permission.EDIT_WELFARE_SUPPORT)) {
    return { error: "You do not have permission to edit welfare support records." };
  }

  const parsed = updateWelfareSupportSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateWelfareSupport(recordId, parsed.data, access);
    revalidatePath("/admin/welfare-support");
    revalidatePath(`/admin/welfare-support/${recordId}`);
    redirect(`/admin/welfare-support/${recordId}?toast=welfare-support-updated`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      error: error instanceof Error ? error.message : "Failed to update welfare support record.",
    };
  }
}
