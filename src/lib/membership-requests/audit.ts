export const MembershipRequestAuditAction = {
  MEMBERSHIP_REQUEST_SUBMITTED: "membership_request_submitted",
  MEMBERSHIP_REQUEST_APPROVED: "membership_request_approved",
  MEMBERSHIP_REQUEST_DECLINED: "membership_request_declined",
  MEMBER_CREATED_FROM_REQUEST: "member_created_from_request",
} as const;

export type MembershipRequestAuditAction =
  (typeof MembershipRequestAuditAction)[keyof typeof MembershipRequestAuditAction];
