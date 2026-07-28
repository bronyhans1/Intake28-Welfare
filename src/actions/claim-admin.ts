"use server";

import { revalidatePath } from "next/cache";
import { slugifyToInternalId } from "@/lib/utils/internal-id";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  canViewAllClaims,
  getClaimById,
  isAdminReviewClaimStatus,
  listFinanceClaims,
  listSubmittedClaims,
  returnClaimForRevision,
} from "@/lib/claims/claim-repository";
import {
  addExecutiveComment,
  approveClaim,
  assignClaimExecutive,
  listClaimExecutives,
  recommendClaim,
  rejectClaim,
  startClaimReview,
  type ClaimExecutiveOption,
} from "@/lib/claims/claim-executive-review";
import {
  completeClaimPayment,
  startClaimPaymentProcessing,
} from "@/lib/claims/claim-finance";
import {
  canAssignClaims,
  canProcessClaimPayments,
  canReviewClaims,
  isFinanceClaimStatus,
} from "@/lib/claims/claim-access";
import {
  getPaymentById,
  toMemberVisiblePaymentSummary,
} from "@/lib/payments/repository";
import {
  canManageClaimTypes,
  canViewClaimTypes,
  createClaimTypeConfig,
  deleteClaimTypeConfig,
  getClaimTypeConfigById,
  listClaimTypeConfigs,
  updateClaimTypeConfig,
} from "@/lib/claims/claim-type-repository";
import {
  canManageConstitutions,
  canViewConstitutions,
  createConstitutionDraft,
  deleteConstitutionDraft,
  getConstitutionById,
  listConstitutionDrafts,
  updateConstitutionDraft,
} from "@/lib/claims/constitution-repository";
import { evaluateMemberEligibilityForClaim } from "@/lib/claims/eligibility-service";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import {
  findMemberByServiceNumber,
  findMemberByServiceNumberSuffix,
} from "@/lib/members/repository";
import {
  formatServiceNumber,
  isValidServiceNumberSuffix,
  normalizeServiceNumberSuffix,
} from "@/lib/utils/service-number";
import {
  addExecutiveCommentSchema,
  approveClaimSchema,
  assignClaimExecutiveSchema,
  claimTypeListQuerySchema,
  completeClaimPaymentSchema,
  constitutionListQuerySchema,
  createClaimTypeConfigSchema,
  createConstitutionDraftSchema,
  financeClaimsListQuerySchema,
  recommendClaimSchema,
  rejectClaimSchema,
  startClaimPaymentProcessingSchema,
  startClaimReviewSchema,
  submittedClaimsListQuerySchema,
  updateClaimTypeConfigSchema,
  updateConstitutionDraftSchema,
  returnClaimForRevisionSchema,
  type AddExecutiveCommentInput,
  type ApproveClaimInput,
  type AssignClaimExecutiveInput,
  type ClaimTypeListQuery,
  type CompleteClaimPaymentInput,
  type ConstitutionListQuery,
  type CreateClaimTypeConfigInput,
  type CreateConstitutionDraftInput,
  type FinanceClaimsListQuery,
  type RecommendClaimInput,
  type RejectClaimInput,
  type StartClaimPaymentProcessingInput,
  type StartClaimReviewInput,
  type SubmittedClaimsListQuery,
  type UpdateClaimTypeConfigInput,
  type UpdateConstitutionDraftInput,
  type ReturnClaimForRevisionInput,
} from "@/lib/validators/claims";
import type { CurrentUser } from "@/types/auth";
import type { MemberEligibilityResult } from "@/lib/claims/eligibility-engine";
import type { SerializedClaim, SerializedClaimTypeConfig } from "@/types/claims";
import type { ClaimListResult } from "@/lib/claims/claim-repository";
import type { MemberVisiblePaymentSummary } from "@/types/payment";

export type ClaimAdminActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: boolean;
  id?: string;
};

const SERVER_UNAVAILABLE =
  "Claims administration is temporarily unavailable. Please try again later.";

function isActor(
  result: CurrentUser | ClaimAdminActionState,
): result is CurrentUser {
  return "uid" in result;
}

async function requireClaimTypeManage(): Promise<
  CurrentUser | ClaimAdminActionState
> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canManageClaimTypes(actor.role)) {
    return { error: "You do not have permission to manage claim types." };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }
  return actor;
}

async function requireClaimTypeView(): Promise<
  CurrentUser | ClaimAdminActionState
> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canViewClaimTypes(actor.role)) {
    return { error: "You do not have permission to view claim types." };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }
  return actor;
}

async function requireConstitutionManage(): Promise<
  CurrentUser | ClaimAdminActionState
> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canManageConstitutions(actor.role)) {
    return { error: "You do not have permission to manage constitutions." };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }
  return actor;
}

async function requireConstitutionView(): Promise<
  CurrentUser | ClaimAdminActionState
> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canViewConstitutions(actor.role)) {
    return { error: "You do not have permission to view constitutions." };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }
  return actor;
}

export async function fetchClaimTypesAction(query: ClaimTypeListQuery) {
  const access = await requireClaimTypeView();
  if (!isActor(access)) return access;

  const parsed = claimTypeListQuerySchema.safeParse(query);
  if (!parsed.success) return { error: "Invalid query parameters." };

  try {
    return {
      success: true as const,
      data: await listClaimTypeConfigs(parsed.data),
      canManage: canManageClaimTypes(access.role),
    };
  } catch {
    return { error: "Failed to load claim types." };
  }
}

export async function fetchClaimTypeAction(typeId: string) {
  const access = await requireClaimTypeView();
  if (!isActor(access)) return access;

  try {
    const type = await getClaimTypeConfigById(typeId);
    if (!type) return { error: "Claim type not found." };
    return {
      success: true as const,
      data: type,
      canManage: canManageClaimTypes(access.role),
    };
  } catch {
    return { error: "Failed to load claim type." };
  }
}

export async function createClaimTypeAction(
  input: CreateClaimTypeConfigInput,
): Promise<ClaimAdminActionState> {
  const access = await requireClaimTypeManage();
  if (!isActor(access)) return access;

  const prepared = {
    ...input,
    code:
      typeof input.code === "string" && input.code.trim()
        ? input.code.trim()
        : slugifyToInternalId(input.displayName ?? ""),
  };

  const parsed = createClaimTypeConfigSchema.safeParse(prepared);
  if (!parsed.success) {
    return {
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await createClaimTypeConfig(parsed.data, access);
    revalidatePath("/admin/claims/types");
    return { success: true, id: result.typeId };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create claim type.",
    };
  }
}

export async function updateClaimTypeAction(
  typeId: string,
  input: UpdateClaimTypeConfigInput,
): Promise<ClaimAdminActionState> {
  const access = await requireClaimTypeManage();
  if (!isActor(access)) return access;

  const parsed = updateClaimTypeConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateClaimTypeConfig(typeId, parsed.data, access);
    revalidatePath("/admin/claims/types");
    revalidatePath(`/admin/claims/types/${typeId}`);
    return { success: true, id: typeId };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update claim type.",
    };
  }
}

export async function deleteClaimTypeAction(
  typeId: string,
): Promise<ClaimAdminActionState> {
  const access = await requireClaimTypeManage();
  if (!isActor(access)) return access;

  try {
    await deleteClaimTypeConfig(typeId, access);
    revalidatePath("/admin/claims/types");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete claim type.",
    };
  }
}

export async function fetchConstitutionDraftsAction(query: ConstitutionListQuery) {
  const access = await requireConstitutionView();
  if (!isActor(access)) return access;

  const parsed = constitutionListQuerySchema.safeParse(query);
  if (!parsed.success) return { error: "Invalid query parameters." };

  try {
    return {
      success: true as const,
      data: await listConstitutionDrafts(parsed.data),
      canManage: canManageConstitutions(access.role),
    };
  } catch {
    return { error: "Failed to load constitution drafts." };
  }
}

export async function fetchConstitutionDraftAction(versionId: string) {
  const access = await requireConstitutionView();
  if (!isActor(access)) return access;

  try {
    const version = await getConstitutionById(versionId);
    if (!version) return { error: "Constitution version not found." };
    return {
      success: true as const,
      data: version,
      canManage: canManageConstitutions(access.role),
    };
  } catch {
    return { error: "Failed to load constitution version." };
  }
}

export async function createConstitutionDraftAction(
  input: CreateConstitutionDraftInput,
): Promise<ClaimAdminActionState> {
  const access = await requireConstitutionManage();
  if (!isActor(access)) return access;

  const parsed = createConstitutionDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await createConstitutionDraft(parsed.data, access);
    revalidatePath("/admin/constitutions");
    return { success: true, id: result.versionId };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to create constitution draft.",
    };
  }
}

export async function updateConstitutionDraftAction(
  versionId: string,
  input: UpdateConstitutionDraftInput,
): Promise<ClaimAdminActionState> {
  const access = await requireConstitutionManage();
  if (!isActor(access)) return access;

  const parsed = updateConstitutionDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateConstitutionDraft(versionId, parsed.data, access);
    revalidatePath("/admin/constitutions");
    revalidatePath(`/admin/constitutions/${versionId}`);
    return { success: true, id: versionId };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to update constitution draft.",
    };
  }
}

export async function deleteConstitutionDraftAction(
  versionId: string,
): Promise<ClaimAdminActionState> {
  const access = await requireConstitutionManage();
  if (!isActor(access)) return access;

  try {
    await deleteConstitutionDraft(versionId, access);
    revalidatePath("/admin/constitutions");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete constitution draft.",
    };
  }
}

async function requireClaimEligibilityView(): Promise<
  CurrentUser | ClaimAdminActionState
> {
  const actor = await getCurrentUserFromSession();
  if (
    !actor ||
    (!hasPermission(actor.role, Permission.VIEW_ALL_CLAIMS) &&
      !canManageClaimTypes(actor.role))
  ) {
    return { error: "You do not have permission to check claim eligibility." };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }
  return actor;
}

export async function fetchClaimTypesForEligibilityAction(): Promise<
  | { success: true; data: SerializedClaimTypeConfig[] }
  | ClaimAdminActionState
> {
  const access = await requireClaimEligibilityView();
  if (!isActor(access)) return access;

  try {
    const listed = await listClaimTypeConfigs(
      claimTypeListQuerySchema.parse({
        page: 1,
        pageSize: 100,
        active: "true",
      }),
    );
    return { success: true, data: listed.types };
  } catch {
    return { error: "Failed to load claim types." };
  }
}

/**
 * Admin eligibility check for a member + claim type.
 * Does not approve, reject, or mutate claim state.
 */
export async function checkMemberClaimEligibilityAction(input: {
  serviceNumber: string;
  claimTypeCode: string;
}): Promise<
  | {
      success: true;
      data: MemberEligibilityResult;
      member: { id: string; fullName: string; serviceNumber: string };
    }
  | ClaimAdminActionState
> {
  const access = await requireClaimEligibilityView();
  if (!isActor(access)) return access;

  const claimTypeCode = input.claimTypeCode?.trim();
  if (!claimTypeCode) {
    return { error: "Select a claim type before checking eligibility." };
  }

  const suffix = normalizeServiceNumberSuffix(input.serviceNumber ?? "");
  if (!isValidServiceNumberSuffix(suffix)) {
    return { error: "Enter a valid service number (e.g. IS/13984 or 13984)." };
  }

  try {
    const fullServiceNumber = formatServiceNumber(suffix);
    const member =
      (await findMemberByServiceNumber(fullServiceNumber)) ??
      (await findMemberByServiceNumberSuffix(suffix));

    if (!member) {
      return { error: "No member found for that service number." };
    }

    const result = await evaluateMemberEligibilityForClaim({
      memberId: member.id,
      claimTypeCode,
    });

    if ("error" in result) {
      return { error: result.error };
    }

    return {
      success: true,
      data: result,
      member: {
        id: member.id,
        fullName: member.fullName,
        serviceNumber: member.serviceNumber,
      },
    };
  } catch {
    return { error: "Failed to evaluate claim eligibility." };
  }
}

async function requireSubmittedClaimsView(): Promise<
  CurrentUser | ClaimAdminActionState
> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canViewAllClaims(actor.role)) {
    return { error: "You do not have permission to view submitted claims." };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }
  return actor;
}

export async function fetchSubmittedClaimsAction(
  query: SubmittedClaimsListQuery,
): Promise<
  | { success: true; data: ClaimListResult }
  | ClaimAdminActionState
> {
  const access = await requireSubmittedClaimsView();
  if (!isActor(access)) return access;

  const parsed = submittedClaimsListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return { error: "Invalid query parameters." };
  }

  try {
    return {
      success: true,
      data: await listSubmittedClaims(parsed.data),
    };
  } catch {
    return { error: "Failed to load submitted claims." };
  }
}

export async function fetchSubmittedClaimAction(
  claimId: string,
): Promise<
  | { success: true; data: SerializedClaim }
  | ClaimAdminActionState
> {
  const access = await requireSubmittedClaimsView();
  if (!isActor(access)) return access;

  try {
    const claim = await getClaimById(claimId);
    if (!claim || !isAdminReviewClaimStatus(claim.status)) {
      return { error: "Claim not found." };
    }
    return { success: true, data: claim };
  } catch {
    return { error: "Failed to load claim." };
  }
}

export async function returnClaimForRevisionAction(
  input: ReturnClaimForRevisionInput,
): Promise<ClaimAdminActionState> {
  const access = await requireSubmittedClaimsView();
  if (!isActor(access)) return access;

  const parsed = returnClaimForRevisionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please provide a return reason.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { claimId, ...reasonInput } = parsed.data;
    await returnClaimForRevision(claimId, reasonInput, access);
    revalidatePath("/admin/claims/submitted");
    revalidatePath(`/admin/claims/submitted/${claimId}`);
    revalidatePath("/portal/claims");
    return { success: true, id: claimId };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to return claim for revision.",
    };
  }
}

async function requireClaimReviewAccess(): Promise<
  CurrentUser | ClaimAdminActionState
> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canReviewClaims(actor.role)) {
    return { error: "You do not have permission to review claims." };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }
  return actor;
}

async function requireClaimAssignAccess(): Promise<
  CurrentUser | ClaimAdminActionState
> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canAssignClaims(actor.role)) {
    return { error: "You do not have permission to assign claims." };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }
  return actor;
}

function revalidateClaimPaths(claimId: string) {
  revalidatePath("/admin/claims/submitted");
  revalidatePath(`/admin/claims/submitted/${claimId}`);
  revalidatePath("/portal/claims");
  revalidatePath(`/portal/claims/${claimId}`);
}

export async function fetchClaimExecutivesAction(): Promise<
  | { success: true; data: ClaimExecutiveOption[] }
  | ClaimAdminActionState
> {
  const access = await requireClaimAssignAccess();
  if (!isActor(access)) return access;

  try {
    return { success: true, data: await listClaimExecutives() };
  } catch {
    return { error: "Failed to load executives." };
  }
}

export async function startClaimReviewAction(
  input: StartClaimReviewInput,
): Promise<ClaimAdminActionState> {
  const access = await requireClaimReviewAccess();
  if (!isActor(access)) return access;

  const parsed = startClaimReviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid claim." };
  }

  try {
    await startClaimReview(parsed.data.claimId, access);
    revalidateClaimPaths(parsed.data.claimId);
    return { success: true, id: parsed.data.claimId };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to start review.",
    };
  }
}

export async function addExecutiveCommentAction(
  input: AddExecutiveCommentInput,
): Promise<ClaimAdminActionState> {
  const access = await requireClaimReviewAccess();
  if (!isActor(access)) return access;

  const parsed = addExecutiveCommentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please provide a valid comment.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { claimId, ...commentInput } = parsed.data;
    await addExecutiveComment(claimId, commentInput, access);
    revalidateClaimPaths(claimId);
    return { success: true, id: claimId };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to add comment.",
    };
  }
}

export async function recommendClaimAction(
  input: RecommendClaimInput,
): Promise<ClaimAdminActionState> {
  const access = await requireClaimReviewAccess();
  if (!isActor(access)) return access;

  const parsed = recommendClaimSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid claim." };
  }

  try {
    await recommendClaim(parsed.data.claimId, access);
    revalidateClaimPaths(parsed.data.claimId);
    return { success: true, id: parsed.data.claimId };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to recommend claim.",
    };
  }
}

export async function approveClaimAction(
  input: ApproveClaimInput,
): Promise<ClaimAdminActionState> {
  const access = await requireClaimReviewAccess();
  if (!isActor(access)) return access;

  const parsed = approveClaimSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid approval request.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { claimId, ...decision } = parsed.data;
    await approveClaim(claimId, decision, access);
    revalidateClaimPaths(claimId);
    return { success: true, id: claimId };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to approve claim.",
    };
  }
}

export async function rejectClaimAction(
  input: RejectClaimInput,
): Promise<ClaimAdminActionState> {
  const access = await requireClaimReviewAccess();
  if (!isActor(access)) return access;

  const parsed = rejectClaimSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please provide a rejection reason.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { claimId, ...rejectInput } = parsed.data;
    await rejectClaim(claimId, rejectInput, access);
    revalidateClaimPaths(claimId);
    return { success: true, id: claimId };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to reject claim.",
    };
  }
}

export async function assignClaimExecutiveAction(
  input: AssignClaimExecutiveInput,
): Promise<ClaimAdminActionState> {
  const access = await requireClaimAssignAccess();
  if (!isActor(access)) return access;

  const parsed = assignClaimExecutiveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please select an executive.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { claimId, ...assignInput } = parsed.data;
    await assignClaimExecutive(claimId, assignInput, access);
    revalidateClaimPaths(claimId);
    return { success: true, id: claimId };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to assign claim.",
    };
  }
}

async function requireClaimFinanceAccess(): Promise<
  CurrentUser | ClaimAdminActionState
> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canProcessClaimPayments(actor.role)) {
    return {
      error: "You do not have permission to process claim payments.",
    };
  }
  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }
  return actor;
}

export async function fetchFinanceClaimsAction(
  query: FinanceClaimsListQuery,
): Promise<{ success: true; data: ClaimListResult } | ClaimAdminActionState> {
  const access = await requireSubmittedClaimsView();
  if (!isActor(access)) return access;

  const parsed = financeClaimsListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return { error: "Invalid query parameters." };
  }

  try {
    return { success: true, data: await listFinanceClaims(parsed.data) };
  } catch {
    return { error: "Failed to load finance claims." };
  }
}

export async function fetchFinanceClaimAction(
  claimId: string,
): Promise<
  | {
      success: true;
      data: SerializedClaim;
      payment: MemberVisiblePaymentSummary | null;
      canProcessPayments: boolean;
    }
  | ClaimAdminActionState
> {
  const access = await requireSubmittedClaimsView();
  if (!isActor(access)) return access;

  try {
    const claim = await getClaimById(claimId);
    if (!claim || !isFinanceClaimStatus(claim.status)) {
      return { error: "Claim not found in finance queue." };
    }

    let payment: MemberVisiblePaymentSummary | null = null;
    if (claim.paymentId) {
      const full = await getPaymentById(claim.paymentId);
      if (full) payment = toMemberVisiblePaymentSummary(full);
    }

    return {
      success: true,
      data: claim,
      payment,
      canProcessPayments: canProcessClaimPayments(access.role),
    };
  } catch {
    return { error: "Failed to load finance claim." };
  }
}

export async function startClaimPaymentProcessingAction(
  input: StartClaimPaymentProcessingInput,
): Promise<ClaimAdminActionState> {
  const access = await requireClaimFinanceAccess();
  if (!isActor(access)) return access;

  const parsed = startClaimPaymentProcessingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid claim." };
  }

  try {
    await startClaimPaymentProcessing(parsed.data.claimId, access);
    revalidateClaimPaths(parsed.data.claimId);
    revalidatePath("/admin/claims/finance");
    revalidatePath("/admin/payments");
    return { success: true, id: parsed.data.claimId };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to start payment processing.",
    };
  }
}

export async function completeClaimPaymentAction(
  input: CompleteClaimPaymentInput,
): Promise<ClaimAdminActionState> {
  const access = await requireClaimFinanceAccess();
  if (!isActor(access)) return access;

  const parsed = completeClaimPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please provide valid payment details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { claimId, ...paymentInput } = parsed.data;
    await completeClaimPayment(claimId, paymentInput, access);
    revalidateClaimPaths(claimId);
    revalidatePath("/admin/claims/finance");
    revalidatePath("/admin/payments");
    return { success: true, id: claimId };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to complete claim payment.",
    };
  }
}
