import { WELFARE_SUPPORT_TYPE_LABELS } from "@/types/enums";

/** Default catalog entries matching the legacy hardcoded Welfare Support types. */
export const DEFAULT_WELFARE_SUPPORT_TYPE_SEEDS = [
  { code: "funeral", displayName: WELFARE_SUPPORT_TYPE_LABELS.funeral, sortOrder: 10 },
  { code: "wedding", displayName: WELFARE_SUPPORT_TYPE_LABELS.wedding, sortOrder: 20 },
  { code: "naming", displayName: WELFARE_SUPPORT_TYPE_LABELS.naming, sortOrder: 30 },
  { code: "medical", displayName: WELFARE_SUPPORT_TYPE_LABELS.medical, sortOrder: 40 },
  { code: "education", displayName: WELFARE_SUPPORT_TYPE_LABELS.education, sortOrder: 50 },
  { code: "emergency", displayName: WELFARE_SUPPORT_TYPE_LABELS.emergency, sortOrder: 60 },
  { code: "bereavement", displayName: WELFARE_SUPPORT_TYPE_LABELS.bereavement, sortOrder: 70 },
  { code: "other", displayName: WELFARE_SUPPORT_TYPE_LABELS.other, sortOrder: 80 },
] as const;
