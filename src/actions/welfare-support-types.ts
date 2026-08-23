"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  canManageWelfareSupportTypes,
  canViewWelfareSupportTypeCatalog,
  createWelfareSupportTypeConfig,
  listActiveWelfareSupportTypes,
  listAllWelfareSupportTypeOptions,
  listWelfareSupportTypeConfigs,
  seedDefaultWelfareSupportTypes,
  updateWelfareSupportTypeConfig,
} from "@/lib/welfare-support-types/repository";
import {
  createWelfareSupportTypeConfigSchema,
  updateWelfareSupportTypeConfigSchema,
  welfareSupportTypeListQuerySchema,
  type CreateWelfareSupportTypeConfigInput,
  type UpdateWelfareSupportTypeConfigInput,
  type WelfareSupportTypeListQuery,
} from "@/lib/welfare-support-types/validation";
import type { CurrentUser } from "@/types/auth";

export type WelfareSupportTypeActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: boolean;
  id?: string;
};

const SERVER_UNAVAILABLE =
  "Welfare support type management is temporarily unavailable. Please try again later.";

async function requireManage(): Promise<
  CurrentUser | WelfareSupportTypeActionState
> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canManageWelfareSupportTypes(actor.role)) {
    return {
      error: "You do not have permission to manage welfare support types.",
    };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }
  return actor;
}

async function requireCatalogView(): Promise<
  CurrentUser | WelfareSupportTypeActionState
> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canViewWelfareSupportTypeCatalog(actor.role)) {
    return {
      error: "You do not have permission to view welfare support types.",
    };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }
  return actor;
}

function isActor(
  result: CurrentUser | WelfareSupportTypeActionState,
): result is CurrentUser {
  return "uid" in result;
}

export async function fetchWelfareSupportTypesAction(
  query: WelfareSupportTypeListQuery,
) {
  const access = await requireManage();
  if (!isActor(access)) return access;

  const parsed = welfareSupportTypeListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return { error: "Invalid query parameters." };
  }

  try {
    return {
      success: true as const,
      data: await listWelfareSupportTypeConfigs(parsed.data),
    };
  } catch {
    return { error: "Failed to load welfare support types." };
  }
}

export async function fetchActiveWelfareSupportTypesAction() {
  const access = await requireCatalogView();
  if (!isActor(access)) return access;

  try {
    return {
      success: true as const,
      data: await listActiveWelfareSupportTypes(),
    };
  } catch {
    return { error: "Failed to load support types." };
  }
}

export async function fetchAllWelfareSupportTypeOptionsAction() {
  const access = await requireCatalogView();
  if (!isActor(access)) return access;

  try {
    return {
      success: true as const,
      data: await listAllWelfareSupportTypeOptions(),
    };
  } catch {
    return { error: "Failed to load support types." };
  }
}

export async function createWelfareSupportTypeAction(
  input: CreateWelfareSupportTypeConfigInput,
): Promise<WelfareSupportTypeActionState> {
  const access = await requireManage();
  if (!isActor(access)) return access;

  const parsed = createWelfareSupportTypeConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await createWelfareSupportTypeConfig(parsed.data, access);
    revalidatePath("/admin/welfare-support/types");
    revalidatePath("/admin/welfare-support/new");
    revalidatePath("/admin/welfare-support");
    return { success: true, id: result.typeId };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to create welfare support type.",
    };
  }
}

export async function updateWelfareSupportTypeAction(
  typeId: string,
  input: UpdateWelfareSupportTypeConfigInput,
): Promise<WelfareSupportTypeActionState> {
  const access = await requireManage();
  if (!isActor(access)) return access;

  const parsed = updateWelfareSupportTypeConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateWelfareSupportTypeConfig(typeId, parsed.data, access);
    revalidatePath("/admin/welfare-support/types");
    revalidatePath("/admin/welfare-support/new");
    revalidatePath("/admin/welfare-support");
    return { success: true, id: typeId };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to update welfare support type.",
    };
  }
}

export async function seedWelfareSupportTypesAction(): Promise<
  WelfareSupportTypeActionState & {
    created?: string[];
    skipped?: string[];
  }
> {
  const access = await requireManage();
  if (!isActor(access)) return access;

  try {
    const result = await seedDefaultWelfareSupportTypes(access);
    revalidatePath("/admin/welfare-support/types");
    revalidatePath("/admin/welfare-support/new");
    revalidatePath("/admin/welfare-support");
    return {
      success: true,
      created: result.created,
      skipped: result.skipped,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to seed welfare support types.",
    };
  }
}
