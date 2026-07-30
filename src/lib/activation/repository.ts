import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { phoneNumbersMatch } from "@/lib/utils/phone";
import { ActivationStatus } from "@/types/enums";
import type { ProfileCompletionSnapshot } from "@/types/user";
import type { User } from "@/types/user";

function mapFirestoreUser(
  id: string,
  data: Record<string, unknown>,
): User {
  return { id, ...data } as User;
}

export async function findUserById(userId: string): Promise<User | null> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.USERS).doc(userId).get();

  if (!doc.exists) {
    return null;
  }

  return mapFirestoreUser(doc.id, doc.data() as Record<string, unknown>);
}

export async function findUserByServiceNumber(
  serviceNumber: string,
): Promise<User | null> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.USERS)
    .where("serviceNumber", "==", serviceNumber)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return mapFirestoreUser(doc.id, doc.data());
}

export async function findUserForActivation(
  serviceNumber: string,
  phoneNumber: string,
): Promise<User | null> {
  const user = await findUserByServiceNumber(serviceNumber);

  if (!user) {
    return null;
  }

  if (!phoneNumbersMatch(user.phoneNumber, phoneNumber)) {
    return null;
  }

  return user;
}

export interface OtpTrackingUpdate {
  lastOtpSentAt?: Date | null;
  otpAttempts?: number;
  otpLockedUntil?: Date | null;
  activationOtpSentCount?: number;
}

export async function updateUserOtpTracking(
  userId: string,
  update: OtpTrackingUpdate,
): Promise<void> {
  const db = getAdminDb();
  const payload: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (update.lastOtpSentAt !== undefined) {
    payload.lastOtpSentAt = update.lastOtpSentAt
      ? Timestamp.fromDate(update.lastOtpSentAt)
      : null;
  }

  if (update.otpAttempts !== undefined) {
    payload.otpAttempts = update.otpAttempts;
  }

  if (update.otpLockedUntil !== undefined) {
    payload.otpLockedUntil = update.otpLockedUntil
      ? Timestamp.fromDate(update.otpLockedUntil)
      : null;
  }

  if (update.activationOtpSentCount !== undefined) {
    payload.activationOtpSentCount = update.activationOtpSentCount;
  }

  await db.collection(COLLECTIONS.USERS).doc(userId).update(payload);
}

export async function activateUserRecord(
  userId: string,
  profileSnapshot: ProfileCompletionSnapshot,
): Promise<void> {
  const db = getAdminDb();

  await db
    .collection(COLLECTIONS.USERS)
    .doc(userId)
    .update({
      activationStatus: ActivationStatus.ACTIVATED,
      activatedAt: FieldValue.serverTimestamp(),
      profileCompleted: profileSnapshot.profileCompleted,
      profileCompletionPercentage: profileSnapshot.profileCompletionPercentage,
      otpAttempts: 0,
      otpLockedUntil: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
}
