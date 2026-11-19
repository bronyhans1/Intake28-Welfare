"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  approveMembershipRequest,
  canReviewMembershipRequests,
  canViewMembershipRequests,
  declineMembershipRequest,
  getMembershipRequestById,
  listMembershipRequests,
  submitMembershipRequest,
} from "@/lib/membership-requests/repository";
import { MembershipRequestConflictError } from "@/lib/membership-requests/duplicates";
import type { MembershipRequestNextAction } from "@/lib/membership-requests/duplicates";
import {
  approveMembershipRequestSchema,
  declineMembershipRequestSchema,
  membershipRequestListQuerySchema,
  submitMembershipRequestSchema,
} from "@/lib/validators/membership-request";
import type { CurrentUser } from "@/types/auth";
import type { MembershipRequestListQuery } from "@/lib/validators/membership-request";

export type MembershipRequestActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: boolean;
  requestId?: string;
  memberId?: string;
  /** Guided next step when Request Access is blocked for an existing member. */
  nextAction?: MembershipRequestNextAction | null;
};

const SERVER_UNAVAILABLE =
  "Membership requests are temporarily unavailable. Please try again later.";

async function requireViewAccess(): Promise<
  CurrentUser | MembershipRequestActionState
> {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewMembershipRequests(actor.role)) {
    return { error: "You do not have permission to view membership requests." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  return actor;
}

async function requireReviewAccess(): Promise<
  CurrentUser | MembershipRequestActionState
> {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canReviewMembershipRequests(actor.role)) {
    return {
      error: "You do not have permission to review membership requests.",
    };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  return actor;
}

function isActor(
  result: CurrentUser | MembershipRequestActionState,
): result is CurrentUser {
  return "uid" in result;
}

/**
 * Public — no session required.
 */
export async function submitMembershipRequestAction(
  input: unknown,
): Promise<MembershipRequestActionState> {
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  const parsed = submitMembershipRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { requestId } = await submitMembershipRequest(parsed.data);
    return { success: true, requestId };
  } catch (error) {
    if (error instanceof MembershipRequestConflictError) {
      return {
        error: error.message,
        nextAction: error.nextAction,
      };
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to submit membership request.",
    };
  }
}

export async function fetchMembershipRequestsList(
  query: MembershipRequestListQuery,
) {
  const access = await requireViewAccess();
  if (!isActor(access)) return access;

  const parsed = membershipRequestListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return { error: "Invalid query parameters." };
  }

  try {
    return {
      success: true as const,
      data: await listMembershipRequests(parsed.data),
    };
  } catch {
    return { error: "Failed to load membership requests." };
  }
}

export async function fetchMembershipRequestById(requestId: string) {
  const access = await requireViewAccess();
  if (!isActor(access)) return access;

  try {
    const request = await getMembershipRequestById(requestId);
    if (!request) return { error: "Membership request not found." };
    return {
      success: true as const,
      data: request,
      canReview: canReviewMembershipRequests(access.role),
    };
  } catch {
    return { error: "Failed to load membership request." };
  }
}

export async function approveMembershipRequestAction(
  input: unknown,
): Promise<MembershipRequestActionState> {
  const access = await requireReviewAccess();
  if (!isActor(access)) return access;

  const parsed = approveMembershipRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { memberId } = await approveMembershipRequest(parsed.data, access);
    revalidatePath("/admin/membership-requests");
    revalidatePath("/admin/members");
    revalidatePath("/admin/members/pending");
    return { success: true, memberId };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to approve membership request.",
    };
  }
}

export async function declineMembershipRequestAction(
  input: unknown,
): Promise<MembershipRequestActionState> {
  const access = await requireReviewAccess();
  if (!isActor(access)) return access;

  const parsed = declineMembershipRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await declineMembershipRequest(parsed.data, access);
    revalidatePath("/admin/membership-requests");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to decline membership request.",
    };
  }
}
