/**
 * Permanent membership claim numbers: GIS-{year}-{sequence}
 * Example: GIS-2026-00001
 */

import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";

const CLAIM_NUMBER_PATTERN = /^GIS-(\d{4})-(\d{5})$/;

export function formatClaimNumber(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Invalid claim number year.");
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 99999) {
    throw new Error("Invalid claim number sequence.");
  }
  return `GIS-${year}-${String(sequence).padStart(5, "0")}`;
}

export function parseClaimNumber(
  claimNumber: string,
): { year: number; sequence: number } | null {
  const match = CLAIM_NUMBER_PATTERN.exec(claimNumber.trim().toUpperCase());
  if (!match) return null;
  return {
    year: Number(match[1]),
    sequence: Number(match[2]),
  };
}

export function isValidClaimNumber(claimNumber: string): boolean {
  return parseClaimNumber(claimNumber) != null;
}

/**
 * Atomically allocates the next claim number for the given calendar year.
 * Numbers are unique, sequential, and never reused.
 */
export async function allocateClaimNumber(
  asOf: Date = new Date(),
): Promise<string> {
  const year = asOf.getFullYear();
  const db = getAdminDb();
  const counterRef = db.collection(COLLECTIONS.CLAIM_COUNTERS).doc(String(year));

  const claimNumber = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(counterRef);
    const lastSequence = snapshot.exists
      ? Number(snapshot.data()?.lastSequence ?? 0)
      : 0;
    const nextSequence = lastSequence + 1;
    const formatted = formatClaimNumber(year, nextSequence);

    transaction.set(
      counterRef,
      {
        year,
        lastSequence: nextSequence,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return formatted;
  });

  return claimNumber;
}
