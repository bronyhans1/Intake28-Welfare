export const WelfareSupportTypeAuditAction = {
  WELFARE_SUPPORT_TYPE_CREATED: "welfare_support_type_created",
  WELFARE_SUPPORT_TYPE_UPDATED: "welfare_support_type_updated",
  WELFARE_SUPPORT_TYPE_SEEDED: "welfare_support_type_seeded",
} as const;

export type WelfareSupportTypeAuditAction =
  (typeof WelfareSupportTypeAuditAction)[keyof typeof WelfareSupportTypeAuditAction];
