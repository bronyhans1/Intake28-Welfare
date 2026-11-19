export const ContributionAuditAction = {
  CONTRIBUTION_CREATED: "contribution_created",
  CONTRIBUTION_UPDATED: "contribution_updated",
} as const;

export type ContributionAuditAction =
  (typeof ContributionAuditAction)[keyof typeof ContributionAuditAction];

