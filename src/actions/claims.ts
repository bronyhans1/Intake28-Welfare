"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  canCreateClaim,
  canViewOwnClaims,
  createClaimDraft,
  deleteClaimDraft,
  getClaimById,
  listMemberClaimDrafts,
  resubmitClaim,
  submitClaimDraft,
  updateClaimDraft,
  updateClaimRevision,
} from "@/lib/claims/claim-repository";
import { listActiveClaimTypesForMembers } from "@/lib/claims/claim-type-repository";
import { evaluateClaimSubmissionEligibility } from "@/lib/claims/claim-progression";
import {
  claimDraftListQuerySchema,
  createClaimDraftSchema,
  resubmitClaimSchema,
  submitClaimSchema,
  updateClaimDraftSchema,
  updateClaimRevisionSchema,
  type ClaimDraftListQuery,
  type CreateClaimDraftInput,
  type UpdateClaimDraftInput,
  type UpdateClaimRevisionInput,
} from "@/lib/validators/claims";
import type { CurrentUser } from "@/types/auth";
import type { ClaimSubmissionEligibilityResult } from "@/lib/claims/claim-progression";

export type ClaimsActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: boolean;
  claimId?: string;
  claimNumber?: string;
};

const SERVER_UNAVAILABLE =
  "Claims services are temporarily unavailable. Please try again later.";

async function requireMemberClaimsAccess(): Promise<
  CurrentUser | ClaimsActionState
> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canViewOwnClaims(actor.role)) {
    return { error: "You do not have permission to view claims." };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }
  return actor;
}

function isActor(
  result: CurrentUser | ClaimsActionState,
): result is CurrentUser {
  return "uid" in result;
}

export async function fetchMyClaimDraftsAction(query: ClaimDraftListQuery) {
  const access = await requireMemberClaimsAccess();
  if (!isActor(access)) return access;

  const parsed = claimDraftListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return { error: "Invalid query parameters." };
  }

  try {
    return {
      success: true as const,
      data: await listMemberClaimDrafts(access.uid, parsed.data),
    };
  } catch {
    return { error: "Failed to load claim drafts." };
  }
}

export async function fetchActiveClaimTypesAction() {
  const access = await requireMemberClaimsAccess();
  if (!isActor(access)) return access;

  try {
    return {
      success: true as const,
      data: await listActiveClaimTypesForMembers(),
    };
  } catch {
    return { error: "Failed to load claim types." };
  }
}

export async function fetchMyClaimDraftAction(claimId: string) {
  const access = await requireMemberClaimsAccess();
  if (!isActor(access)) return access;

  try {
    const claim = await getClaimById(claimId);
    if (!claim || claim.memberId !== access.uid) {
      return { error: "Claim draft not found." };
    }
    return { success: true as const, data: claim };
  } catch {
    return { error: "Failed to load claim draft." };
  }
}

export async function createClaimDraftAction(
  input: CreateClaimDraftInput,
): Promise<ClaimsActionState> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canCreateClaim(actor.role)) {
    return { error: "You do not have permission to create claims." };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  const parsed = createClaimDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await createClaimDraft(parsed.data, actor);
    revalidatePath("/portal/claims");
    return { success: true, claimId: result.claimId };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create claim draft.",
    };
  }
}

export async function updateClaimDraftAction(
  claimId: string,
  input: UpdateClaimDraftInput,
): Promise<ClaimsActionState> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canCreateClaim(actor.role)) {
    return { error: "You do not have permission to update claims." };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  const parsed = updateClaimDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateClaimDraft(claimId, parsed.data, actor);
    revalidatePath("/portal/claims");
    revalidatePath(`/portal/claims/${claimId}`);
    return { success: true, claimId };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update claim draft.",
    };
  }
}

export async function deleteClaimDraftAction(
  claimId: string,
): Promise<ClaimsActionState> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canCreateClaim(actor.role)) {
    return { error: "You do not have permission to delete claims." };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  try {
    await deleteClaimDraft(claimId, actor);
    revalidatePath("/portal/claims");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete claim draft.",
    };
  }
}

/**
 * Automatic eligibility evaluation for the selected claim type.
 * Used when a draft is opened or the claim type changes — no button required.
 */
export async function evaluateMyClaimEligibilityAction(
  claimTypeCode: string,
): Promise<
  | { success: true; data: ClaimSubmissionEligibilityResult }
  | ClaimsActionState
> {
  const access = await requireMemberClaimsAccess();
  if (!isActor(access)) return access;

  const code = claimTypeCode?.trim();
  if (!code) {
    return { error: "Select a claim type to evaluate eligibility." };
  }

  try {
    const result = await evaluateClaimSubmissionEligibility({
      memberId: access.uid,
      claimTypeCode: code,
    });
    if ("error" in result) {
      return { error: result.error };
    }
    return { success: true, data: result };
  } catch {
    return { error: "Failed to evaluate claim eligibility." };
  }
}

/** @deprecated Prefer evaluateMyClaimEligibilityAction — kept for compatibility */
export async function checkMyClaimEligibilityAction(claimTypeCode: string) {
  return evaluateMyClaimEligibilityAction(claimTypeCode);
}

export async function submitClaimDraftAction(
  claimId: string,
): Promise<ClaimsActionState> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canCreateClaim(actor.role)) {
    return { error: "You do not have permission to submit claims." };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  const parsed = submitClaimSchema.safeParse({ claimId });
  if (!parsed.success) {
    return { error: "Invalid claim." };
  }

  try {
    const result = await submitClaimDraft(parsed.data.claimId, actor);
    revalidatePath("/portal/claims");
    revalidatePath("/admin/claims/submitted");
    return {
      success: true,
      claimId: result.claimId,
      claimNumber: result.claimNumber,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to submit claim.",
    };
  }
}

export async function updateClaimRevisionAction(
  claimId: string,
  input: UpdateClaimRevisionInput,
): Promise<ClaimsActionState> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canCreateClaim(actor.role)) {
    return { error: "You do not have permission to update claims." };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  const parsed = updateClaimRevisionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateClaimRevision(claimId, parsed.data, actor);
    revalidatePath("/portal/claims");
    revalidatePath(`/admin/claims/submitted/${claimId}`);
    return { success: true, claimId };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to update claim revision.",
    };
  }
}

export async function resubmitClaimAction(
  claimId: string,
): Promise<ClaimsActionState> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canCreateClaim(actor.role)) {
    return { error: "You do not have permission to resubmit claims." };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  const parsed = resubmitClaimSchema.safeParse({ claimId });
  if (!parsed.success) {
    return { error: "Invalid claim." };
  }

  try {
    const result = await resubmitClaim(parsed.data.claimId, actor);
    revalidatePath("/portal/claims");
    revalidatePath("/admin/claims/submitted");
    revalidatePath(`/admin/claims/submitted/${result.claimId}`);
    return {
      success: true,
      claimId: result.claimId,
      claimNumber: result.claimNumber,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to resubmit claim.",
    };
  }
}
