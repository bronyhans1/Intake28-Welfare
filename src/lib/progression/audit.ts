export const ProgressionAuditAction = {
  PROGRESSION_RECALCULATED: "progression_recalculated",
  BENEFIT_PERCENTAGE_CHANGED: "progression_benefit_percentage_changed",
  MEMBERSHIP_STATUS_CHANGED: "progression_membership_status_changed",
  MATURITY_REACHED: "progression_maturity_reached",
  CLAIM_ELIGIBILITY_GAINED: "progression_claim_eligibility_gained",
} as const;

export type ProgressionAuditAction =
  (typeof ProgressionAuditAction)[keyof typeof ProgressionAuditAction];

export const PROGRESSION_AUDIT_SYSTEM_ACTOR = {
  performedBy: "progression-engine",
  performedByRole: "system",
  actorId: "progression-engine",
  actorName: "Membership Progression Engine",
  role: "system",
} as const;
