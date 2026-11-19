export const WelfareSupportAuditAction = {
  WELFARE_SUPPORT_CREATED: "welfare_support_created",
  WELFARE_SUPPORT_UPDATED: "welfare_support_updated",
} as const;

export type WelfareSupportAuditAction =
  (typeof WelfareSupportAuditAction)[keyof typeof WelfareSupportAuditAction];
