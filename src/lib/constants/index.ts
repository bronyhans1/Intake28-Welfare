/** GIS service number prefix — members never type this; admin enters suffix only */
export const SERVICE_NUMBER_PREFIX = "IS/" as const;

export const COLLECTIONS = {
  USERS: "users",
  CONTRIBUTIONS: "contributions",
  PAYMENTS: "payments",
  RECEIPTS: "receipts",
  ANNOUNCEMENTS: "announcements",
  AUDIT_LOGS: "audit_logs",
  SYSTEM: "system",
  WELFARE_SUPPORT: "welfare_support",
  NOTIFICATION_EVENTS: "notification_events",
  NOTIFICATION_READS: "notification_reads",
  PHONE_VERIFICATIONS: "phone_verifications",
  CLAIMS: "claims",
  CLAIM_TYPE_CONFIGS: "claim_type_configs",
  CLAIM_COUNTERS: "claim_counters",
  CONSTITUTIONS: "constitutions",
  MEMBERSHIP_PROGRESSIONS: "membership_progressions",
  MEMBERSHIP_REQUESTS: "membership_requests",
} as const;

export const SYSTEM_DOCS = {
  SETTINGS: "settings",
} as const;

export const STORAGE_PATHS = {
  PROFILE_PHOTOS: "profile-photos",
  RECEIPTS: "receipts",
  CLAIMS: "claims",
  ANNOUNCEMENTS: "announcements",
  CONSTITUTION: "constitution",
} as const;

export const PROFILE_PHOTO = {
  MAX_SIZE_BYTES: 5 * 1024 * 1024,
  MAX_DIMENSION: 800,
  WEBP_QUALITY: 0.8,
  OUTPUT_EXTENSION: "webp",
  OUTPUT_CONTENT_TYPE: "image/webp",
  OUTPUT_FILENAME: "profile.webp",
  ACCEPTED_MIME_TYPES: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ] as const,
  ACCEPTED_EXTENSIONS: [".jpg", ".jpeg", ".png", ".webp"] as const,
} as const;

/** Optional single attachment on a membership claim (Phase 3) */
export const CLAIM_ATTACHMENT = {
  MAX_SIZE_BYTES: 5 * 1024 * 1024,
  ACCEPTED_MIME_TYPES: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ] as const,
} as const;

export const IMPORT_COLUMNS = [
  "serviceNumberSuffix",
  "fullName",
  "phoneNumber",
  "rank",
  "station",
] as const;

export {
  PROFILE_COMPLETION_DEFAULTS,
  PROFILE_COMPLETION_FIELD_LABELS,
  PROFILE_COMPLETION_FIELDS,
  PROFILE_COMPLETION_TOTAL_FIELDS,
  type ProfileCompletionField,
} from "./profile-completion";

export {
  ACTIVATION_OTP,
  ACTIVATION_OTP_DEFAULTS,
} from "./activation-otp";

export { PHONE_VERIFICATION_OTP } from "./phone-verification";
