import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS, SYSTEM_DOCS } from "@/lib/constants";
import { getCurrentMonthYear, monthYearKey } from "@/lib/finance/period";
import { getAdminDb } from "@/lib/firebase/admin";
import { sanitizeFirestoreData } from "@/lib/firestore/sanitize";
import { recalculateMembershipProgression } from "@/lib/progression/engine";

export interface ProgressionMonthBoundaryResult {
  asOfKey: string;
  scannedMembers: number;
  recalculated: number;
  skippedAlreadyCurrent: boolean;
  errors: number;
}

/**
 * Idempotent Africa/Accra month-boundary progression refresh.
 *
 * Safe to run repeatedly within the same Accra calendar month — only one
 * full sweep is performed per asOf month (tracked on system state doc).
 * Individual member recalculations remain idempotent (no duplicate resets).
 */
export async function runProgressionMonthBoundary(
  options: { force?: boolean } = {},
): Promise<ProgressionMonthBoundaryResult> {
  const asOf = getCurrentMonthYear();
  const asOfKey = monthYearKey(asOf);
  const db = getAdminDb();
  const stateRef = db
    .collection(COLLECTIONS.SYSTEM)
    .doc(SYSTEM_DOCS.PROGRESSION_MONTH_BOUNDARY);
  const stateSnap = await stateRef.get();
  const lastAsOfKey =
    typeof stateSnap.data()?.lastAsOfKey === "string"
      ? (stateSnap.data()?.lastAsOfKey as string)
      : null;

  if (!options.force && lastAsOfKey === asOfKey) {
    return {
      asOfKey,
      scannedMembers: 0,
      recalculated: 0,
      skippedAlreadyCurrent: true,
      errors: 0,
    };
  }

  const usersSnap = await db.collection(COLLECTIONS.USERS).get();
  let recalculated = 0;
  let errors = 0;

  for (const doc of usersSnap.docs) {
    try {
      await recalculateMembershipProgression(doc.id);
      recalculated += 1;
    } catch (error) {
      errors += 1;
      console.error("[progression-month-boundary] Failed member recalc", {
        memberId: doc.id,
        error,
      });
    }
  }

  await stateRef.set(
    sanitizeFirestoreData({
      lastAsOfKey: asOfKey,
      lastAsOfMonth: asOf.month,
      lastAsOfYear: asOf.year,
      lastRunAt: FieldValue.serverTimestamp(),
      lastRecalculated: recalculated,
      lastErrors: errors,
      updatedAt: FieldValue.serverTimestamp(),
    }),
    { merge: true },
  );

  return {
    asOfKey,
    scannedMembers: usersSnap.size,
    recalculated,
    skippedAlreadyCurrent: false,
    errors,
  };
}
