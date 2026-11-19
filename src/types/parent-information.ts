export const PARENT_STATUSES = ["alive", "deceased"] as const;
export type ParentStatus = (typeof PARENT_STATUSES)[number];

export const PARENT_STATUS_LABELS: Record<ParentStatus, string> = {
  alive: "Alive",
  deceased: "Deceased",
};

export const PARENT_INFORMATION_LOCK_DAYS = 365;

export const PARENT_INFORMATION_OVERRIDE_REASONS = [
  "Typographical correction",
  "Official document received",
  "Member correction request",
  "Administrative update",
  "Other",
] as const;

export type ParentInformationOverrideReason =
  (typeof PARENT_INFORMATION_OVERRIDE_REASONS)[number];

/** Snapshot of mother/father fields used for validation, saves, and audit diffs */
export interface ParentInformationValues {
  motherFullName: string;
  motherStatus: ParentStatus;
  fatherFullName: string;
  fatherStatus: ParentStatus;
}

export interface ParentInformationAuditSnapshot {
  motherFullName: string | null;
  motherStatus: ParentStatus | null;
  fatherFullName: string | null;
  fatherStatus: ParentStatus | null;
}

export interface ParentInformationOverrideEntry {
  id: string;
  previous: ParentInformationAuditSnapshot;
  next: ParentInformationValues;
  overrideReason: string;
  overriddenBy: string;
  overriddenByName: string;
  /** ISO timestamp string for cross-SDK compatibility */
  overriddenAt: string;
}

export interface ParentInformationFormInput {
  motherFullName: string;
  motherStatus: ParentStatus | "";
  fatherFullName: string;
  fatherStatus: ParentStatus | "";
}

export interface ParentInformationOverrideInput extends ParentInformationFormInput {
  overrideReason: ParentInformationOverrideReason | "";
  overrideReasonDetail?: string;
}
