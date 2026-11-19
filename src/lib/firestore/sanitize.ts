import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { normalizeGender } from "@/lib/utils/gender";
import { safeNumber } from "@/lib/firestore/safe-number";

const MEMBER_COUNTER_FIELDS = new Set([
  "otpAttempts",
  "activationOtpSentCount",
  "profileCompletionPercentage",
  "consecutiveUnpaidMonths",
]);

function isFirestoreWriteValue(value: unknown): boolean {
  return (
    value instanceof Timestamp ||
    value instanceof Date ||
    value instanceof FieldValue
  );
}

function sanitizePrimitive(value: unknown): unknown {
  if (typeof value === "number" && !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function sanitizeValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  const primitive = sanitizePrimitive(value);
  if (primitive !== value) {
    return primitive;
  }

  if (isFirestoreWriteValue(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item === undefined) {
        return null;
      }

      if (typeof item === "number" && !Number.isFinite(item)) {
        return null;
      }

      if (item !== null && typeof item === "object" && !isFirestoreWriteValue(item)) {
        return sanitizeFirestoreData(item as Record<string, unknown>);
      }

      return item;
    });
  }

  if (value !== null && typeof value === "object") {
    return sanitizeFirestoreData(value as Record<string, unknown>);
  }

  return value;
}

/**
 * Ensures Firestore never receives `undefined`, `NaN`, or `Infinity`.
 * Undefined fields are omitted; invalid numbers become null.
 */
export function sanitizeFirestoreData<T extends Record<string, unknown>>(
  data: T,
): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue;
    }

    result[key] = sanitizeValue(value);
  }

  return result as T;
}

export interface AuditLogChangeInput {
  before: unknown;
  after: unknown;
}

/**
 * Normalizes audit change values so Firestore never receives undefined or invalid numbers.
 * Preserves the `{ before, after }` structure with explicit nulls.
 */
export function sanitizeAuditChangeValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    return null;
  }

  if (isFirestoreWriteValue(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditChangeValue(item));
  }

  if (value !== null && typeof value === "object") {
    return sanitizeFirestoreData(value as Record<string, unknown>);
  }

  return value;
}

export function sanitizeAuditChanges(
  changes: Record<string, AuditLogChangeInput>,
): Record<string, AuditLogChangeInput> {
  const result: Record<string, AuditLogChangeInput> = {};

  for (const [field, change] of Object.entries(changes)) {
    const before = sanitizeAuditChangeValue(change.before);
    const after = sanitizeAuditChangeValue(change.after);

    if (before === null && after === null) {
      continue;
    }

    result[field] = { before, after };
  }

  return result;
}

/**
 * Normalizes member field values used in audit diffs and update payloads.
 */
export function normalizeMemberFieldValue(field: string, value: unknown): unknown {
  if (MEMBER_COUNTER_FIELDS.has(field)) {
    return safeNumber(value, 0);
  }

  if (value === undefined) {
    return null;
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    return null;
  }

  if (
    field === "nextOfKin" ||
    field === "emergencyContact" ||
    field === "rank" ||
    field === "station"
  ) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed || null;
    }

    return value ?? null;
  }

  if (field === "gender") {
    return normalizeGender(value);
  }

  return value;
}

function collectInvalidFirestoreValues(
  value: unknown,
  path: string,
  issues: string[],
): void {
  if (value === undefined) {
    issues.push(`${path}: undefined`);
    return;
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    issues.push(`${path}: ${value}`);
    return;
  }

  if (isFirestoreWriteValue(value)) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectInvalidFirestoreValues(item, `${path}[${index}]`, issues);
    });
    return;
  }

  if (value !== null && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      collectInvalidFirestoreValues(nestedValue, `${path}.${key}`, issues);
    }
  }
}

/** Dev-only warning when a payload still contains invalid Firestore values. */
export function warnInvalidFirestorePayload(label: string, payload: unknown): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const issues: string[] = [];
  collectInvalidFirestoreValues(payload, label, issues);

  if (issues.length > 0) {
    console.warn(
      `[firestore:sanitize] Invalid payload detected (${label}):`,
      issues,
    );
  }
}
