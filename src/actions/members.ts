"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  canManageMembers,
  canViewMembers,
  changeMemberStatus,
  createMember,
  getMemberById,
  listMembers,
  resetActivation,
  updateMember,
} from "@/lib/members/repository";
import {
  createMemberSchema,
  memberListQuerySchema,
  updateMemberSchema,
} from "@/lib/validators/member";
import { UserStatus } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";
import type { MemberListQuery, UpdateMemberFormInput } from "@/lib/validators/member";
import type { CreateMemberFormInput } from "@/lib/validators/member";

export type MemberActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: boolean;
};

const SERVER_UNAVAILABLE =
  "Member management is temporarily unavailable. Please try again later.";

async function requireViewAccess(): Promise<CurrentUser | MemberActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewMembers(actor.role)) {
    return { error: "You do not have permission to view members." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  return actor;
}

async function requireManageAccess(): Promise<CurrentUser | MemberActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canManageMembers(actor.role)) {
    return { error: "You do not have permission to manage members." };
  }

  if (!hasPermission(actor.role, Permission.ADD_MEMBER)) {
    return { error: "You do not have permission to manage members." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  return actor;
}

function isActor(result: CurrentUser | MemberActionState): result is CurrentUser {
  return "uid" in result;
}

export async function fetchMembersList(query: MemberListQuery) {
  const access = await requireViewAccess();
  if (!isActor(access)) return access;

  const parsed = memberListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return { error: "Invalid query parameters." };
  }

  try {
    return { success: true as const, data: await listMembers(parsed.data) };
  } catch {
    return { error: "Failed to load members." };
  }
}

export async function fetchMemberById(memberId: string) {
  const access = await requireViewAccess();
  if (!isActor(access)) return access;

  try {
    const member = await getMemberById(memberId);
    if (!member) return { error: "Member not found." };
    return { success: true as const, data: member, canManage: canManageMembers(access.role) };
  } catch {
    return { error: "Failed to load member." };
  }
}

export async function createMemberAction(
  input: CreateMemberFormInput,
): Promise<MemberActionState> {
  const access = await requireManageAccess();
  if (!isActor(access)) return access;

  const parsed = createMemberSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { memberId } = await createMember(parsed.data, access);
    redirect(`/admin/members/${memberId}?toast=member-created`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      error: error instanceof Error ? error.message : "Failed to create member.",
    };
  }
}

export async function updateMemberAction(
  memberId: string,
  input: UpdateMemberFormInput,
): Promise<MemberActionState> {
  const access = await requireManageAccess();
  if (!isActor(access)) return access;

  if (!hasPermission(access.role, Permission.EDIT_MEMBER)) {
    return { error: "You do not have permission to edit members." };
  }

  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateMember(memberId, parsed.data, access);
    revalidatePath("/admin/members");
    revalidatePath(`/admin/members/${memberId}`);
    revalidatePath("/admin/dashboard");
    redirect(`/admin/members/${memberId}?toast=member-updated`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      error: error instanceof Error ? error.message : "Failed to update member.",
    };
  }
}

export async function resetMemberActivationAction(
  memberId: string,
): Promise<MemberActionState> {
  const access = await requireManageAccess();
  if (!isActor(access)) return access;

  try {
    await resetActivation(memberId, access);
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to reset activation.",
    };
  }
}

export async function changeMemberStatusAction(
  memberId: string,
  status: UserStatus,
): Promise<MemberActionState> {
  const access = await requireManageAccess();
  if (!isActor(access)) return access;

  if (!hasPermission(access.role, Permission.DEACTIVATE_MEMBER)) {
    return { error: "You do not have permission to change member status." };
  }

  try {
    await changeMemberStatus(memberId, status, access);
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to change member status.",
    };
  }
}

export async function suspendMemberAction(memberId: string) {
  return changeMemberStatusAction(memberId, UserStatus.SUSPENDED);
}

export async function activateMemberAction(memberId: string) {
  return changeMemberStatusAction(memberId, UserStatus.ACTIVE);
}

export async function deactivateMemberAction(memberId: string) {
  return changeMemberStatusAction(memberId, UserStatus.INACTIVE);
}
