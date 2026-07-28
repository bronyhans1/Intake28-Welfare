import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { COLLECTIONS } from "@/lib/constants";
import { PHONE_VERIFICATION_OTP } from "@/lib/constants/phone-verification";
import { getAdminDb } from "@/lib/firebase/admin";
import { sanitizeFirestoreData, warnInvalidFirestorePayload } from "@/lib/firestore/sanitize";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import {
  DUPLICATE_PHONE_NUMBER_ERROR,
} from "@/lib/members/duplicates";
import {
  findMemberByPhoneNumber,
} from "@/lib/members/repository";
import { updateProfileCompletion, type ProfileCompletionUser } from "@/lib/profile/profile-completion";
import { pickParentCompletionFields } from "@/lib/parent-information/validation";
import { normalizeMemberEmail } from "@/lib/members/email";
import { sendOtpSms, verifyOtp } from "@/lib/notifications/otp-sms";
import { emitProfileNotificationEvent } from "@/lib/notifications/profile-events";
import { NotificationEventType } from "@/lib/notifications/types";
import { PhoneVerificationAuditAction } from "@/lib/phone-verification/audit";
import {
  generatePhoneVerificationOtpCode,
  getPhoneVerificationOtpExpiry,
  hashPhoneVerificationOtp,
  isPhoneVerificationOtpExpired,
} from "@/lib/phone-verification/otp";
import type {
  PhoneVerification,
  PhoneVerificationStatus,
  SerializedPhoneVerification,
} from "@/types/phone-verification";
import { PhoneVerificationStatus as Status } from "@/types/phone-verification";
import type { CurrentUser } from "@/types/auth";
import type { User } from "@/types/user";

function mapFirestoreUser(id: string, data: Record<string, unknown>): User {
  return { id, ...data } as User;
}

async function getMemberUser(memberId: string): Promise<User | null> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.USERS).doc(memberId).get();
  if (!doc.exists) return null;
  return mapFirestoreUser(doc.id, doc.data() as Record<string, unknown>);
}

function mapFirestoreDoc(id: string, data: Record<string, unknown>): PhoneVerification {
  return { id, ...data } as PhoneVerification;
}

function toDate(value: Timestamp | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "toDate" in value) {
    return (value as Timestamp).toDate();
  }
  return null;
}

function serializeRecord(record: PhoneVerification): SerializedPhoneVerification {
  const { id, otpCode, ...rest } = record;
  void otpCode;
  return serializeFirestoreDoc(id, {
    ...rest,
    expiresAt: toDate(record.expiresAt)?.toISOString() ?? "",
    verifiedAt: record.verifiedAt ? toDate(record.verifiedAt)?.toISOString() ?? null : null,
  }) as unknown as SerializedPhoneVerification;
}

async function cancelPendingVerifications(memberId: string): Promise<void> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.PHONE_VERIFICATIONS)
    .where("memberId", "==", memberId)
    .where("status", "==", Status.PENDING)
    .get();

  const batch = db.batch();
  for (const doc of snapshot.docs) {
    batch.update(doc.ref, { status: Status.CANCELLED });
  }
  if (!snapshot.empty) {
    await batch.commit();
  }
}

async function getVerificationRecord(
  verificationId: string,
): Promise<PhoneVerification | null> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.PHONE_VERIFICATIONS).doc(verificationId).get();
  if (!doc.exists) return null;
  return mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>);
}

async function markVerificationExpired(
  verification: PhoneVerification,
  actor: CurrentUser,
): Promise<void> {
  const db = getAdminDb();
  await db.collection(COLLECTIONS.PHONE_VERIFICATIONS).doc(verification.id).update({
    status: Status.EXPIRED,
  });

  const existing = await getMemberUser(verification.memberId);
  await createAuditLog({
    action: PhoneVerificationAuditAction.PHONE_VERIFICATION_EXPIRED,
    entityType: "user",
    entityId: verification.memberId,
    ...buildAuditActor(actor),
    metadata: {
      serviceNumber: verification.serviceNumber,
      fullName: existing?.fullName ?? actor.fullName,
      actorName: actor.fullName,
      verificationId: verification.id,
    },
  });
}

function ensureVerificationOwnership(
  verification: PhoneVerification,
  actor: CurrentUser,
): void {
  if (verification.memberId !== actor.uid) {
    throw new Error("You can only verify your own phone number.");
  }
}

export interface PhoneVerificationRequestResult {
  verificationId: string;
  expiresAt: string;
  devOtp?: string;
  message: string;
}

export async function requestPhoneVerification(
  memberId: string,
  newPhone: string,
  actor: CurrentUser,
): Promise<PhoneVerificationRequestResult> {
  if (actor.uid !== memberId) {
    throw new Error("You can only change your own phone number.");
  }

  const existing = await getMemberUser(memberId);
  if (!existing) {
    throw new Error("Member not found.");
  }

  if (existing.phoneNumber === newPhone) {
    throw new Error("This is already your current phone number.");
  }

  const duplicate = await findMemberByPhoneNumber(newPhone);
  if (duplicate && duplicate.id !== memberId) {
    throw new Error(DUPLICATE_PHONE_NUMBER_ERROR);
  }

  await cancelPendingVerifications(memberId);

  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.PHONE_VERIFICATIONS).doc();
  const otp = generatePhoneVerificationOtpCode();
  const now = new Date();
  const expiresAt = getPhoneVerificationOtpExpiry(now);

  const document = sanitizeFirestoreData({
    memberId,
    serviceNumber: existing.serviceNumber,
    currentPhone: existing.phoneNumber,
    newPhone,
    otpCode: hashPhoneVerificationOtp(ref.id, otp),
    status: Status.PENDING,
    attemptCount: 0,
    resendCount: 0,
    expiresAt: Timestamp.fromDate(expiresAt),
    verifiedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.uid,
  });

  warnInvalidFirestorePayload("requestPhoneVerification", document);
  await ref.set(document);

  const smsResult = await sendOtpSms(newPhone, otp, {
    memberId,
    serviceNumber: existing.serviceNumber,
    verificationId: ref.id,
  });

  await createAuditLog({
    action: PhoneVerificationAuditAction.PHONE_VERIFICATION_REQUESTED,
    entityType: "user",
    entityId: memberId,
    ...buildAuditActor(actor),
    metadata: {
      serviceNumber: existing.serviceNumber,
      fullName: existing.fullName,
      actorName: actor.fullName,
      verificationId: ref.id,
      newPhone,
    },
  });

  return {
    verificationId: ref.id,
    expiresAt: expiresAt.toISOString(),
    devOtp: smsResult.devCode,
    message: smsResult.message ?? "Verification code sent.",
  };
}

export async function resendPhoneVerification(
  verificationId: string,
  actor: CurrentUser,
): Promise<PhoneVerificationRequestResult> {
  const verification = await getVerificationRecord(verificationId);
  if (!verification) {
    throw new Error("Verification session not found.");
  }

  ensureVerificationOwnership(verification, actor);

  if (verification.status !== Status.PENDING) {
    throw new Error("This verification session is no longer active.");
  }

  const expiresAtDate = toDate(verification.expiresAt);
  if (isPhoneVerificationOtpExpired(expiresAtDate)) {
    await markVerificationExpired(verification, actor);
    throw new Error("Verification code expired. Please request a new code.");
  }

  if (verification.resendCount >= PHONE_VERIFICATION_OTP.MAX_RESENDS) {
    throw new Error("Maximum resend limit reached. Please start a new verification.");
  }

  const otp = generatePhoneVerificationOtpCode();
  const now = new Date();
  const newExpiresAt = getPhoneVerificationOtpExpiry(now);

  const db = getAdminDb();
  await db.collection(COLLECTIONS.PHONE_VERIFICATIONS).doc(verificationId).update(
    sanitizeFirestoreData({
      otpCode: hashPhoneVerificationOtp(verificationId, otp),
      resendCount: verification.resendCount + 1,
      expiresAt: Timestamp.fromDate(newExpiresAt),
      attemptCount: 0,
    }),
  );

  const smsResult = await sendOtpSms(verification.newPhone, otp, {
    memberId: verification.memberId,
    serviceNumber: verification.serviceNumber,
    verificationId,
  });

  return {
    verificationId,
    expiresAt: newExpiresAt.toISOString(),
    devOtp: smsResult.devCode,
    message: smsResult.message ?? "Verification code resent.",
  };
}

export interface PhoneVerificationVerifyResult {
  success: boolean;
  error?: string;
  newPhone?: string;
}

async function applyVerifiedPhoneChange(
  existing: User,
  newPhone: string,
  actor: CurrentUser,
): Promise<void> {
  const db = getAdminDb();
  const beforePhone = existing.phoneNumber;

  const profileSnapshot: ProfileCompletionUser = {
    fullName: existing.fullName,
    phoneNumber: newPhone,
    email: normalizeMemberEmail(existing.email),
    dateOfBirth: existing.dateOfBirth,
    rank: existing.rank,
    station: existing.station,
    nextOfKin: existing.nextOfKin ?? null,
    emergencyContact: existing.emergencyContact ?? null,
    profilePhotoUrl: existing.profilePhotoUrl ?? null,
    ...pickParentCompletionFields(existing),
  };

  const updatePayload = sanitizeFirestoreData({
    phoneNumber: newPhone,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("applyVerifiedPhoneChange", updatePayload);
  await db.collection(COLLECTIONS.USERS).doc(existing.id).update(updatePayload);
  await updateProfileCompletion(existing.id, profileSnapshot);

  await emitProfileNotificationEvent({
    memberId: existing.id,
    memberName: existing.fullName,
    serviceNumber: existing.serviceNumber,
    eventType: NotificationEventType.PROFILE_PHONE_CHANGED,
    actorId: actor.uid,
    actorName: actor.fullName,
    metadata: {
      field: "phoneNumber",
      before: beforePhone,
      after: newPhone,
    },
  });
}

export async function verifyPhoneVerification(
  verificationId: string,
  otp: string,
  actor: CurrentUser,
): Promise<PhoneVerificationVerifyResult> {
  const verification = await getVerificationRecord(verificationId);
  if (!verification) {
    return { success: false, error: "Verification session not found." };
  }

  ensureVerificationOwnership(verification, actor);

  if (verification.status !== Status.PENDING) {
    return { success: false, error: "This verification session is no longer active." };
  }

  const expiresAtDate = toDate(verification.expiresAt);
  if (isPhoneVerificationOtpExpired(expiresAtDate)) {
    await markVerificationExpired(verification, actor);
    return {
      success: false,
      error: "Verification code expired. Please request a new code.",
    };
  }

  const existing = await getMemberUser(verification.memberId);
  if (!existing) {
    return { success: false, error: "Member not found." };
  }

  const isValid = verifyOtp(verificationId, otp, verification.otpCode);
  const db = getAdminDb();

  if (!isValid) {
    const nextAttempts = verification.attemptCount + 1;

    await db.collection(COLLECTIONS.PHONE_VERIFICATIONS).doc(verificationId).update({
      attemptCount: nextAttempts,
      ...(nextAttempts >= PHONE_VERIFICATION_OTP.MAX_ATTEMPTS
        ? { status: Status.CANCELLED }
        : {}),
    });

    await createAuditLog({
      action: PhoneVerificationAuditAction.PHONE_VERIFICATION_FAILED,
      entityType: "user",
      entityId: verification.memberId,
      ...buildAuditActor(actor),
      metadata: {
        serviceNumber: verification.serviceNumber,
        fullName: existing.fullName,
        actorName: actor.fullName,
        verificationId,
        attemptCount: nextAttempts,
      },
    });

    if (nextAttempts >= PHONE_VERIFICATION_OTP.MAX_ATTEMPTS) {
      return {
        success: false,
        error: "Too many failed attempts. Please request a new verification code.",
      };
    }

    return { success: false, error: "Invalid verification code. Please try again." };
  }

  const duplicate = await findMemberByPhoneNumber(verification.newPhone);
  if (duplicate && duplicate.id !== verification.memberId) {
    await db.collection(COLLECTIONS.PHONE_VERIFICATIONS).doc(verificationId).update({
      status: Status.CANCELLED,
    });
    return { success: false, error: DUPLICATE_PHONE_NUMBER_ERROR };
  }

  await db.collection(COLLECTIONS.PHONE_VERIFICATIONS).doc(verificationId).update(
    sanitizeFirestoreData({
      status: Status.VERIFIED,
      verifiedAt: FieldValue.serverTimestamp(),
    }),
  );

  await applyVerifiedPhoneChange(existing, verification.newPhone, actor);

  await createAuditLog({
    action: PhoneVerificationAuditAction.PHONE_VERIFICATION_COMPLETED,
    entityType: "user",
    entityId: verification.memberId,
    ...buildAuditActor(actor),
    changes: {
      phoneNumber: { before: verification.currentPhone, after: verification.newPhone },
    },
    metadata: {
      serviceNumber: verification.serviceNumber,
      fullName: existing.fullName,
      actorName: actor.fullName,
      verificationId,
    },
  });

  return { success: true, newPhone: verification.newPhone };
}

export async function getPhoneVerificationById(
  verificationId: string,
): Promise<SerializedPhoneVerification | null> {
  const record = await getVerificationRecord(verificationId);
  return record ? serializeRecord(record) : null;
}

export function isPhoneVerificationStatus(
  value: string,
): value is PhoneVerificationStatus {
  return Object.values(Status).includes(value as PhoneVerificationStatus);
}
