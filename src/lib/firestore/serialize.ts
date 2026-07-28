import { Timestamp } from "firebase-admin/firestore";

const TIMESTAMP_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "activatedAt",
  "lastOtpSentAt",
  "otpLockedUntil",
  "dateOfBirth",
  "defaulterSince",
  "paidAt",
  "profilePhotoUpdatedAt",
  "parentInformationLastUpdated",
  "parentInformationLockedUntil",
  "readAt",
  "archivedAt",
  "submittedAt",
  "returnedAt",
  "resubmittedAt",
  "reviewStartedAt",
  "recommendedAt",
  "approvedAt",
  "rejectedAt",
  "assignedAt",
  "financeQueuedAt",
  "paymentProcessingAt",
  "maturityDate",
  "lastSuccessfulContributionDate",
  "lastCalculatedAt",
]);

export function isFirestoreTimestamp(value: unknown): value is Timestamp {
  if (value instanceof Timestamp) {
    return true;
  }

  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as Timestamp).toDate === "function" &&
    "seconds" in value &&
    typeof (value as { seconds: unknown }).seconds === "number"
  );
}

export function serializeTimestampValue(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (isFirestoreTimestamp(value)) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
}

function serializeValue(value: unknown): unknown {
  if (isFirestoreTimestamp(value)) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (value && typeof value === "object") {
    return serializeFirestoreFields(value as Record<string, unknown>);
  }

  return value;
}

export function serializeFirestoreFields(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (TIMESTAMP_FIELDS.has(key)) {
      result[key] = serializeTimestampValue(value);
      continue;
    }

    result[key] = serializeValue(value);
  }

  return result;
}

export function serializeFirestoreDoc<T extends Record<string, unknown>>(
  id: string,
  data: Record<string, unknown>,
): T {
  return {
    id,
    ...serializeFirestoreFields(data),
  } as unknown as T;
}
