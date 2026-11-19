import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { sanitizeFirestoreData, warnInvalidFirestorePayload } from "@/lib/firestore/sanitize";
import {
  HUBTEL_NO_RECORD_RESPONSE_CODE,
  type HubtelStatusRequestError,
} from "@/lib/integrations/hubtel/status";
import { PaymentAuditAction } from "@/lib/payments/audit";
import type { CurrentUser } from "@/types/auth";
import type { SerializedPayment } from "@/types/payment";

/**
 * After a definitive RMSC no-record (4720), skip automatic reconciliation
 * lookups for this window. Manual verify / force-recheck always bypasses.
 * Window is finite so unresolved payments are not excluded forever.
 */
export const HUBTEL_NO_RECORD_SUPPRESS_MS = 24 * 60 * 60 * 1000;

export type HubtelNoRecordLookupSource =
  | "reconciliation"
  | "reconciliation_recheck"
  | "verify";

function parseCheckedAtMs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }
  return null;
}

/** True when automatic reconciliation should not call RMSC again yet. */
export function isHubtelNoRecordSuppressed(
  payment: Pick<
    SerializedPayment,
    "hubtelNoRecordCheckedAt" | "hubtelNoRecordResponseCode"
  >,
  now: Date = new Date(),
): boolean {
  const checkedAtMs = parseCheckedAtMs(payment.hubtelNoRecordCheckedAt);
  if (checkedAtMs == null) {
    return false;
  }
  if (now.getTime() - checkedAtMs >= HUBTEL_NO_RECORD_SUPPRESS_MS) {
    return false;
  }
  const code = payment.hubtelNoRecordResponseCode?.trim();
  if (code && code !== HUBTEL_NO_RECORD_RESPONSE_CODE) {
    return false;
  }
  return true;
}

async function findPaymentDocByReference(reference: string): Promise<{
  id: string;
  data: Record<string, unknown>;
} | null> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.PAYMENTS)
    .where("reference", "==", reference)
    .limit(1)
    .get();
  const doc = snapshot.docs[0];
  if (!doc) return null;
  return { id: doc.id, data: doc.data() as Record<string, unknown> };
}

/**
 * Persist a definitive no-record observation without changing payment status.
 * Compatible with existing documents (optional fields only; no migration).
 */
export async function persistHubtelNoRecordLookup(
  reference: string,
  details: {
    responseCode: string | null;
    httpStatus: number | null;
    source: HubtelNoRecordLookupSource;
    actor?: CurrentUser;
  },
): Promise<void> {
  const trimmed = reference.trim();
  if (!trimmed) return;

  const found = await findPaymentDocByReference(trimmed);
  if (!found) return;

  const responseCode =
    details.responseCode?.trim() || HUBTEL_NO_RECORD_RESPONSE_CODE;
  const document = sanitizeFirestoreData({
    hubtelNoRecordCheckedAt: Timestamp.now(),
    hubtelNoRecordResponseCode: responseCode,
    updatedAt: FieldValue.serverTimestamp(),
  });
  warnInvalidFirestorePayload("persistHubtelNoRecordLookup", document);
  await getAdminDb().collection(COLLECTIONS.PAYMENTS).doc(found.id).update(document);

  const actorFields = details.actor
    ? buildAuditActor(details.actor)
    : {
        performedBy: "hubtel-reconciliation",
        performedByRole: "system",
        actorId: "hubtel-reconciliation",
        actorName: "Hubtel Reconciliation",
        role: "system",
      };

  await createAuditLog({
    action: PaymentAuditAction.PAYMENT_HUBTEL_STATUS_LOOKUP,
    entityType: "payment",
    entityId: trimmed,
    ...actorFields,
    metadata: {
      outcome: "no_record",
      responseCode,
      httpStatus: details.httpStatus,
      source: details.source,
      provider: found.data.provider ?? null,
      portalStatus: found.data.status ?? null,
    },
  });
}

/** Clear suppression after a later lookup finds a Hubtel transaction. */
export async function clearHubtelNoRecordLookup(
  reference: string,
): Promise<void> {
  const trimmed = reference.trim();
  if (!trimmed) return;

  const found = await findPaymentDocByReference(trimmed);
  if (!found) return;
  if (
    found.data.hubtelNoRecordCheckedAt == null &&
    found.data.hubtelNoRecordResponseCode == null
  ) {
    return;
  }

  const document = sanitizeFirestoreData({
    hubtelNoRecordCheckedAt: null,
    hubtelNoRecordResponseCode: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  warnInvalidFirestorePayload("clearHubtelNoRecordLookup", document);
  await getAdminDb().collection(COLLECTIONS.PAYMENTS).doc(found.id).update(document);
}

export async function persistHubtelNoRecordFromStatusError(
  reference: string,
  error: HubtelStatusRequestError,
  source: HubtelNoRecordLookupSource,
  actor?: CurrentUser,
): Promise<void> {
  if (error.kind !== "no_record") return;
  await persistHubtelNoRecordLookup(reference, {
    responseCode: error.responseCode,
    httpStatus: error.httpStatus,
    source,
    actor,
  });
}
