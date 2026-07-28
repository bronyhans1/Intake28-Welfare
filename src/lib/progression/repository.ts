import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { sanitizeFirestoreData, warnInvalidFirestorePayload } from "@/lib/firestore/sanitize";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import {
  PROGRESSION_AUDIT_SYSTEM_ACTOR,
  ProgressionAuditAction,
} from "@/lib/progression/audit";
import type { ProgressionCalculationResult } from "@/lib/progression/calculator";
import type {
  MembershipProgression,
  MembershipProgressionSummary,
  OutstandingContributionMonth,
  SerializedMembershipProgression,
} from "@/types/membership-progression";

function mapDoc(
  id: string,
  data: Record<string, unknown>,
): MembershipProgression {
  return { memberId: id, ...data } as MembershipProgression;
}

function normalizeOutstandingMonths(
  value: unknown,
): OutstandingContributionMonth[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const month = Number(row.month);
      const year = Number(row.year);
      if (!Number.isFinite(month) || !Number.isFinite(year)) return null;
      if (month < 1 || month > 12) return null;
      return { month, year };
    })
    .filter((item): item is OutstandingContributionMonth => item != null);
}

function serializeRecord(
  record: MembershipProgression,
): SerializedMembershipProgression {
  const { memberId, ...rest } = record;
  const serialized = serializeFirestoreDoc(memberId, rest as Record<string, unknown>);
  const { id: _id, ...fields } = serialized as Record<string, unknown> & {
    id: string;
  };
  void _id;
  const data = fields as Omit<SerializedMembershipProgression, "memberId">;
  return {
    memberId,
    ...data,
    outstandingContributionMonths:
      typeof data.outstandingContributionMonths === "number"
        ? data.outstandingContributionMonths
        : normalizeOutstandingMonths(data.outstandingMonths).length,
    outstandingMonths: normalizeOutstandingMonths(data.outstandingMonths),
  };
}

export function toProgressionSummary(
  record: SerializedMembershipProgression,
): MembershipProgressionSummary {
  return {
    memberId: record.memberId,
    welfarePoints: record.welfarePoints,
    benefitPercentage: record.benefitPercentage,
    membershipStatus: record.membershipStatus,
    isMature: record.isMature,
    eligibleToClaim: record.eligibleToClaim,
    successfulContributionMonths: record.successfulContributionMonths,
    consecutiveContributionMonths: record.consecutiveContributionMonths,
    consecutiveMissedMonths: record.consecutiveMissedMonths,
    outstandingContributionMonths: record.outstandingContributionMonths ?? 0,
    outstandingMonths: record.outstandingMonths ?? [],
    maturityDate: record.maturityDate,
    lastSuccessfulContributionDate: record.lastSuccessfulContributionDate,
    lastCalculatedAt: record.lastCalculatedAt,
  };
}

export async function getProgressionByMemberId(
  memberId: string,
): Promise<SerializedMembershipProgression | null> {
  const db = getAdminDb();
  const doc = await db
    .collection(COLLECTIONS.MEMBERSHIP_PROGRESSIONS)
    .doc(memberId)
    .get();

  if (!doc.exists) return null;

  return serializeRecord(
    mapDoc(doc.id, doc.data() as Record<string, unknown>),
  );
}

/** Single collection read for executive aggregation / reports. */
export async function listAllMembershipProgressions(): Promise<
  SerializedMembershipProgression[]
> {
  const db = getAdminDb();
  const snapshot = await db.collection(COLLECTIONS.MEMBERSHIP_PROGRESSIONS).get();

  return snapshot.docs.map((doc) =>
    serializeRecord(mapDoc(doc.id, doc.data() as Record<string, unknown>)),
  );
}

function parseIsoToTimestamp(iso: string | null): Timestamp | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return Timestamp.fromDate(date);
}

async function writeProgressionChangeAudits(
  result: ProgressionCalculationResult,
  previous: SerializedMembershipProgression | null,
  isNew: boolean,
): Promise<void> {
  const entityType = "membership_progression";
  const entityId = result.memberId;
  const actor = PROGRESSION_AUDIT_SYSTEM_ACTOR;

  const hasMeaningfulChange =
    isNew ||
    !previous ||
    previous.welfarePoints !== result.welfarePoints ||
    previous.benefitPercentage !== result.benefitPercentage ||
    previous.membershipStatus !== result.membershipStatus ||
    previous.isMature !== result.isMature ||
    previous.eligibleToClaim !== result.eligibleToClaim ||
    previous.outstandingContributionMonths !==
      result.outstandingContributionMonths ||
    previous.successfulContributionMonths !==
      result.successfulContributionMonths;

  if (!hasMeaningfulChange) {
    return;
  }

  await createAuditLog({
    action: ProgressionAuditAction.PROGRESSION_RECALCULATED,
    entityType,
    entityId,
    ...actor,
    metadata: {
      memberId: result.memberId,
      outstandingContributionMonths: result.outstandingContributionMonths,
      welfarePoints: result.welfarePoints,
      membershipStatus: result.membershipStatus,
    },
  });

  if (
    previous &&
    previous.benefitPercentage !== result.benefitPercentage
  ) {
    await createAuditLog({
      action: ProgressionAuditAction.BENEFIT_PERCENTAGE_CHANGED,
      entityType,
      entityId,
      ...actor,
      changes: {
        benefitPercentage: {
          before: previous.benefitPercentage,
          after: result.benefitPercentage,
        },
      },
      metadata: {
        memberId: result.memberId,
      },
    });
  }

  if (previous && previous.membershipStatus !== result.membershipStatus) {
    await createAuditLog({
      action: ProgressionAuditAction.MEMBERSHIP_STATUS_CHANGED,
      entityType,
      entityId,
      ...actor,
      changes: {
        membershipStatus: {
          before: previous.membershipStatus,
          after: result.membershipStatus,
        },
      },
      metadata: {
        memberId: result.memberId,
      },
    });
  }

  if (result.isMature && (!previous || !previous.isMature)) {
    await createAuditLog({
      action: ProgressionAuditAction.MATURITY_REACHED,
      entityType,
      entityId,
      ...actor,
      metadata: {
        memberId: result.memberId,
        welfarePoints: result.welfarePoints,
        maturityDate: result.maturityDate,
      },
    });
  }

  if (result.eligibleToClaim && (!previous || !previous.eligibleToClaim)) {
    await createAuditLog({
      action: ProgressionAuditAction.CLAIM_ELIGIBILITY_GAINED,
      entityType,
      entityId,
      ...actor,
      metadata: {
        memberId: result.memberId,
        benefitPercentage: result.benefitPercentage,
      },
    });
  }
}

/**
 * Upsert progression for a member. Document ID = memberId.
 * Writes change-only progression audit entries.
 */
export async function upsertMembershipProgression(
  result: ProgressionCalculationResult,
  options: { isNew?: boolean } = {},
): Promise<SerializedMembershipProgression> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.MEMBERSHIP_PROGRESSIONS).doc(result.memberId);
  const existing = await ref.get();
  const isNew = options.isNew ?? !existing.exists;
  const previous = existing.exists
    ? serializeRecord(mapDoc(existing.id, existing.data() as Record<string, unknown>))
    : null;

  const payload = sanitizeFirestoreData({
    memberId: result.memberId,
    welfarePoints: result.welfarePoints,
    benefitPercentage: result.benefitPercentage,
    successfulContributionMonths: result.successfulContributionMonths,
    consecutiveContributionMonths: result.consecutiveContributionMonths,
    consecutiveMissedMonths: result.consecutiveMissedMonths,
    outstandingContributionMonths: result.outstandingContributionMonths,
    outstandingMonths: result.outstandingMonths,
    isMature: result.isMature,
    eligibleToClaim: result.eligibleToClaim,
    membershipStatus: result.membershipStatus,
    maturityDate: parseIsoToTimestamp(result.maturityDate),
    lastSuccessfulContributionDate: parseIsoToTimestamp(
      result.lastSuccessfulContributionDate,
    ),
    lastCalculatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    ...(isNew ? { createdAt: FieldValue.serverTimestamp() } : {}),
  });

  warnInvalidFirestorePayload("upsertMembershipProgression", payload);

  if (isNew) {
    await ref.set(payload);
  } else {
    await ref.set(payload, { merge: true });
  }

  try {
    await writeProgressionChangeAudits(result, previous, isNew);
  } catch (error) {
    console.error("[progression] Failed to write progression audit logs", {
      memberId: result.memberId,
      error,
    });
  }

  const saved = await getProgressionByMemberId(result.memberId);
  if (!saved) {
    throw new Error("Failed to persist membership progression.");
  }
  return saved;
}

export async function syncMemberDefaulterFields(
  memberId: string,
  input: {
    outstandingContributionMonths: number;
    isDefaulter: boolean;
  },
): Promise<void> {
  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    consecutiveUnpaidMonths: input.outstandingContributionMonths,
    isDefaulter: input.isDefaulter,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("syncMemberDefaulterFields", payload);
  await db.collection(COLLECTIONS.USERS).doc(memberId).update(payload);
}
