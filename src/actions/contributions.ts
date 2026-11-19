"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  canManageContributions,
  canViewContributions,
  createContribution,
  findPaidMonthlyDuesContribution,
  getContributionById,
  listContributions,
  reverseContribution,
  updateContribution,
  getContributionStats,
} from "@/lib/contributions/repository";
import {
  contributionListQuerySchema,
  createContributionSchema,
  updateContributionSchema,
  type ContributionListQuery,
  type CreateContributionInput,
  type UpdateContributionInput,
} from "@/lib/validators/contributions";
import { getMonthlyDuesAmount } from "@/lib/system-settings/repository";
import type { CurrentUser } from "@/types/auth";

export type ContributionsActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: boolean;
};

const SERVER_UNAVAILABLE =
  "Contributions management is temporarily unavailable. Please try again later.";

async function requireViewAccess(): Promise<CurrentUser | ContributionsActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewContributions(actor.role)) {
    return { error: "You do not have permission to view contributions." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  return actor;
}

async function requireManageAccess(): Promise<CurrentUser | ContributionsActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canManageContributions(actor.role)) {
    return { error: "You do not have permission to manage contributions." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  return actor;
}

function isActor(
  result: CurrentUser | ContributionsActionState,
): result is CurrentUser {
  return "uid" in result;
}

export async function fetchContributionsList(query: ContributionListQuery) {
  const access = await requireViewAccess();
  if (!isActor(access)) return access;

  const parsed = contributionListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return { error: "Invalid query parameters." };
  }

  try {
    return { success: true as const, data: await listContributions(parsed.data) };
  } catch {
    return { error: "Failed to load contribution records." };
  }
}

export async function fetchContributionRecord(recordId: string) {
  const access = await requireViewAccess();
  if (!isActor(access)) return access;

  try {
    const record = await getContributionById(recordId);
    if (!record) return { error: "Contribution record not found." };
    return {
      success: true as const,
      data: record,
      canManage: canManageContributions(access.role),
    };
  } catch {
    return { error: "Failed to load contribution record." };
  }
}

export async function fetchContributionStats(filters?: {
  memberId?: string;
  month?: number;
  year?: number;
}) {
  const access = await requireViewAccess();
  if (!isActor(access)) return access;

  try {
    return { success: true as const, data: await getContributionStats(filters) };
  } catch {
    return { error: "Failed to load contribution stats." };
  }
}

export async function fetchMonthlyDuesAmount() {
  const access = await requireManageAccess();
  if (!isActor(access)) return access;

  try {
    return { success: true as const, data: await getMonthlyDuesAmount() };
  } catch {
    return { error: "Failed to load monthly dues configuration." };
  }
}

/**
 * Whether the member already has a paid monthly-dues contribution for the
 * selected Contribution Month (admin Record Contribution UX).
 */
export async function checkPaidMonthlyDuesMonthAction(
  memberId: string,
  month: number,
  year: number,
): Promise<{ exists: boolean } | ContributionsActionState> {
  const access = await requireManageAccess();
  if (!isActor(access)) return access;

  if (
    !memberId.trim() ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(year) ||
    year < 2020
  ) {
    return { error: "Invalid contribution month." };
  }

  try {
    const existing = await findPaidMonthlyDuesContribution(
      memberId.trim(),
      month,
      year,
    );
    return { exists: Boolean(existing) };
  } catch {
    return { error: "Failed to check contribution month." };
  }
}

export async function createContributionAction(
  input: CreateContributionInput,
): Promise<ContributionsActionState> {
  const access = await requireManageAccess();
  if (!isActor(access)) return access;

  const parsed = createContributionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { recordId } = await createContribution(parsed.data, access);
    revalidatePath("/admin/contributions");
    redirect(`/admin/contributions/${recordId}?toast=contribution-created`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to create contribution record.",
    };
  }
}

export async function updateContributionAction(
  recordId: string,
  input: UpdateContributionInput,
): Promise<ContributionsActionState> {
  const access = await requireManageAccess();
  if (!isActor(access)) return access;

  if (!hasPermission(access.role, Permission.MANAGE_CONTRIBUTIONS)) {
    return { error: "You do not have permission to edit contributions." };
  }

  const parsed = updateContributionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateContribution(recordId, parsed.data, access);
    revalidatePath("/admin/contributions");
    revalidatePath(`/admin/contributions/${recordId}`);
    redirect(`/admin/contributions/${recordId}?toast=contribution-updated`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to update contribution record.",
    };
  }
}

export async function reverseContributionAction(
  recordId: string,
  reason?: string | null,
): Promise<ContributionsActionState> {
  const access = await requireManageAccess();
  if (!isActor(access)) return access;

  if (!hasPermission(access.role, Permission.MANAGE_CONTRIBUTIONS)) {
    return { error: "You do not have permission to reverse contributions." };
  }

  try {
    await reverseContribution(recordId, access, reason);
    revalidatePath("/admin/contributions");
    revalidatePath(`/admin/contributions/${recordId}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to reverse contribution.",
    };
  }
}

