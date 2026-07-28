import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { sanitizeFirestoreData, warnInvalidFirestorePayload } from "@/lib/firestore/sanitize";
import { PaymentStatus } from "@/types/enums";
import type { Payment } from "@/types/payment";

/** Pending payments older than this threshold are marked abandoned. */
export const PAYMENT_ABANDONMENT_HOURS = 24;

export const PAYMENT_ABANDONMENT_MS = PAYMENT_ABANDONMENT_HOURS * 60 * 60 * 1000;

function toDate(value: Timestamp | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "toDate" in value) {
    return (value as Timestamp).toDate();
  }
  return null;
}

export function isPaymentAbandonmentEligible(
  payment: Pick<Payment, "status" | "createdAt">,
  now: Date = new Date(),
): boolean {
  if (payment.status !== PaymentStatus.PENDING) {
    return false;
  }

  const createdAt = toDate(payment.createdAt);
  if (!createdAt) {
    return false;
  }

  return now.getTime() - createdAt.getTime() >= PAYMENT_ABANDONMENT_MS;
}

export async function abandonStalePendingPayments(now: Date = new Date()): Promise<number> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.PAYMENTS)
    .where("status", "==", PaymentStatus.PENDING)
    .get();

  let updated = 0;

  for (const doc of snapshot.docs) {
    const payment = { id: doc.id, ...doc.data() } as Payment;
    if (!isPaymentAbandonmentEligible(payment, now)) {
      continue;
    }

    const document = sanitizeFirestoreData({
      status: PaymentStatus.ABANDONED,
      updatedAt: FieldValue.serverTimestamp(),
    });

    warnInvalidFirestorePayload("abandonStalePendingPayments", document);
    await doc.ref.update(document);
    updated += 1;
  }

  return updated;
}
