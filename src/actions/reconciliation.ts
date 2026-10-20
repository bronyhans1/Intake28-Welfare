"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { canRecoverUnsettledPayments } from "@/lib/finance/reconciliation-permissions";
import {
  recoverUnsettledPaystackPayment,
  type UnsettledPaymentRecoveryOutcome,
} from "@/lib/finance/recover-unsettled-payment";

export type RecoverUnsettledPaymentActionResult = {
  ok: boolean;
  outcome: UnsettledPaymentRecoveryOutcome;
  reference: string;
  message: string;
};

export async function recoverUnsettledPaymentAction(
  reference: string,
): Promise<RecoverUnsettledPaymentActionResult> {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canRecoverUnsettledPayments(actor.role)) {
    return {
      ok: false,
      outcome: "unauthorized",
      reference: typeof reference === "string" ? reference.trim() : "",
      message: "You do not have permission to recover unsettled payments.",
    };
  }

  if (!isFirebaseAdminConfigured()) {
    return {
      ok: false,
      outcome: "ineligible",
      reference: typeof reference === "string" ? reference.trim() : "",
      message: "Recovery is temporarily unavailable.",
    };
  }

  if (typeof reference !== "string" || reference.trim() === "") {
    return {
      ok: false,
      outcome: "ineligible",
      reference: "",
      message: "Payment reference is required.",
    };
  }

  const result = await recoverUnsettledPaystackPayment(reference, actor);

  if (result.outcome === "recovered" || result.outcome === "already_settled") {
    revalidatePath("/admin/finance/reconciliation");
  }

  return {
    ok: result.outcome === "recovered" || result.outcome === "already_settled",
    outcome: result.outcome,
    reference: result.reference,
    message: result.message,
  };
}
