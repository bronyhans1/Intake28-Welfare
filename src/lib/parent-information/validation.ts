import {
  PARENT_INFORMATION_LOCK_DAYS,
  PARENT_STATUSES,
  type ParentInformationFormInput,
  type ParentInformationValues,
  type ParentStatus,
} from "@/types/parent-information";

export interface ParentInformationValidationResult {
  success: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ParentInformationFormInput, string>>;
  values?: ParentInformationValues;
}

function normalizeName(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function isParentStatus(value: unknown): value is ParentStatus {
  return (
    typeof value === "string" &&
    (PARENT_STATUSES as readonly string[]).includes(value)
  );
}

export function isParentRecordComplete(
  fullName: string | null | undefined,
  status: string | null | undefined,
): boolean {
  return normalizeName(fullName).length > 0 && isParentStatus(status);
}

/**
 * Validates mother + father name/status pairing rules.
 * Both parents must be fully completed to save.
 */
export function validateParentInformationInput(
  input: ParentInformationFormInput,
): ParentInformationValidationResult {
  const motherFullName = normalizeName(input.motherFullName);
  const fatherFullName = normalizeName(input.fatherFullName);
  const motherStatus = input.motherStatus;
  const fatherStatus = input.fatherStatus;

  const fieldErrors: ParentInformationValidationResult["fieldErrors"] = {};

  const motherHasStatus = isParentStatus(motherStatus);
  const fatherHasStatus = isParentStatus(fatherStatus);
  const motherHasName = motherFullName.length > 0;
  const fatherHasName = fatherFullName.length > 0;

  if (!motherHasStatus && !motherHasName && !fatherHasStatus && !fatherHasName) {
    return {
      success: false,
      error: "Enter Parent Information for both mother and father before saving.",
    };
  }

  if (motherHasStatus && !motherHasName) {
    fieldErrors.motherFullName =
      "Mother full name is required when status is selected.";
  }
  if (motherHasName && !motherHasStatus) {
    fieldErrors.motherStatus =
      "Select Alive or Deceased for mother when a name is entered.";
  }
  if (!motherHasStatus && !motherHasName) {
    fieldErrors.motherStatus = "Mother status is required.";
    fieldErrors.motherFullName = "Mother full name is required.";
  }

  if (fatherHasStatus && !fatherHasName) {
    fieldErrors.fatherFullName =
      "Father full name is required when status is selected.";
  }
  if (fatherHasName && !fatherHasStatus) {
    fieldErrors.fatherStatus =
      "Select Alive or Deceased for father when a name is entered.";
  }
  if (!fatherHasStatus && !fatherHasName) {
    fieldErrors.fatherStatus = "Father status is required.";
    fieldErrors.fatherFullName = "Father full name is required.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please correct the Parent Information errors below.",
      fieldErrors,
    };
  }

  return {
    success: true,
    values: {
      motherFullName,
      motherStatus: motherStatus as ParentStatus,
      fatherFullName,
      fatherStatus: fatherStatus as ParentStatus,
    },
  };
}

export function addParentInformationLockDays(
  from: Date,
  days: number = PARENT_INFORMATION_LOCK_DAYS,
): Date {
  const lockedUntil = new Date(from.getTime());
  lockedUntil.setUTCDate(lockedUntil.getUTCDate() + days);
  return lockedUntil;
}

export function parseParentInformationDate(
  value: Date | string | { toDate?: () => Date; seconds?: number } | null | undefined,
): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object") {
    if (typeof value.toDate === "function") {
      const date = value.toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value.seconds === "number") {
      return new Date(value.seconds * 1000);
    }
  }
  return null;
}

export function isParentInformationLocked(
  member: {
    parentInformationCompleted?: boolean | null;
    parentInformationLockedUntil?: unknown;
  },
  now: Date = new Date(),
): boolean {
  if (!member.parentInformationCompleted) {
    return false;
  }

  const lockedUntil = parseParentInformationDate(
    member.parentInformationLockedUntil as
      | Date
      | string
      | { toDate?: () => Date; seconds?: number }
      | null
      | undefined,
  );

  if (!lockedUntil) {
    return false;
  }

  return lockedUntil.getTime() > now.getTime();
}

export function formatParentStatusLabel(
  status: string | null | undefined,
): string {
  if (status === "alive") return "Alive";
  if (status === "deceased") return "Deceased";
  return "—";
}

export function parentInformationSnapshotFromRecord(record: {
  motherFullName?: string | null;
  motherStatus?: string | null;
  fatherFullName?: string | null;
  fatherStatus?: string | null;
}): ParentInformationValues | null {
  if (
    !isParentRecordComplete(record.motherFullName, record.motherStatus) ||
    !isParentRecordComplete(record.fatherFullName, record.fatherStatus)
  ) {
    return null;
  }

  return {
    motherFullName: normalizeName(record.motherFullName),
    motherStatus: record.motherStatus as ParentStatus,
    fatherFullName: normalizeName(record.fatherFullName),
    fatherStatus: record.fatherStatus as ParentStatus,
  };
}

/** Pass-through helper so other profile writes preserve parent completion fields */
export function pickParentCompletionFields(record: {
  motherFullName?: string | null;
  motherStatus?: string | null;
  fatherFullName?: string | null;
  fatherStatus?: string | null;
}): {
  motherFullName: string | null;
  motherStatus: ParentStatus | null;
  fatherFullName: string | null;
  fatherStatus: ParentStatus | null;
} {
  return {
    motherFullName: record.motherFullName ?? null,
    motherStatus: (record.motherStatus as ParentStatus | null | undefined) ?? null,
    fatherFullName: record.fatherFullName ?? null,
    fatherStatus: (record.fatherStatus as ParentStatus | null | undefined) ?? null,
  };
}
