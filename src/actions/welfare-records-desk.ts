"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  canProcessClaimPayments,
} from "@/lib/claims/claim-access";
import { listMemberAwaitingPaymentClaims } from "@/lib/claims/claim-repository";
import { payClaimFromWelfareRecords } from "@/lib/claims/claim-finance";
import {
  completeClaimPaymentSchema,
  type CompleteClaimPaymentInput,
} from "@/lib/validators/claims";
import type { CurrentUser } from "@/types/auth";
import type { SerializedClaim } from "@/types/claims";

export type WelfareRecordsDeskActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: boolean;
  id?: string;
  paymentId?: string;
};

export type FetchMemberAwaitingPaymentClaimsResult =
  | { success: true; data: SerializedClaim[] }
  | { error: string };

const SERVER_UNAVAILABLE =
  "Welfare Records is temporarily unavailable. Please try again later.";

async function requireClaimPaymentAccess(): Promise<
  CurrentUser | WelfareRecordsDeskActionState
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

function isActor(
  result: CurrentUser | WelfareRecordsDeskActionState,
): result is CurrentUser {
  return "uid" in result;
}

function revalidateWelfareDeskPaths(claimId: string) {
  revalidatePath("/admin/welfare-support");
  revalidatePath("/admin/welfare-support/new");
  revalidatePath("/admin/claims/finance");
  revalidatePath(`/admin/claims/finance/${claimId}`);
  revalidatePath(`/admin/claims/submitted/${claimId}`);
  revalidatePath("/admin/payments");
  revalidatePath("/portal/welfare-support");
  revalidatePath("/dashboard");
  revalidatePath(`/portal/claims/${claimId}`);
}

/**
 * Load a member's claims awaiting (or in) payment for the Welfare Records desk.
 */
export async function fetchMemberAwaitingPaymentClaimsAction(
  memberId: string,
): Promise<FetchMemberAwaitingPaymentClaimsResult> {
  const access = await requireClaimPaymentAccess();
  if (!isActor(access)) {
    return { error: access.error ?? "You do not have permission to process claim payments." };
  }

  const trimmed = typeof memberId === "string" ? memberId.trim() : "";
  if (!trimmed) {
    return { error: "Select a member to view claims awaiting payment." };
  }

  try {
    return {
      success: true,
      data: await listMemberAwaitingPaymentClaims(trimmed),
    };
  } catch {
    return { error: "Failed to load claims awaiting payment." };
  }
}

/**
 * Pay an approved claim from Welfare Records (orchestrates existing finance engine).
 */
export async function payClaimFromWelfareRecordsAction(
  input: CompleteClaimPaymentInput,
): Promise<WelfareRecordsDeskActionState> {
  const access = await requireClaimPaymentAccess();
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
    const result = await payClaimFromWelfareRecords(
      claimId,
      paymentInput,
      access,
    );
    revalidateWelfareDeskPaths(claimId);
    return { success: true, id: claimId, paymentId: result.paymentId };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to pay claim from Welfare Records.",
    };
  }
}
