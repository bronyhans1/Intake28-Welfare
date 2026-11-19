import type { Timestamp } from "firebase-admin/firestore";

export const MembershipRequestStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  DECLINED: "DECLINED",
} as const;

export type MembershipRequestStatus =
  (typeof MembershipRequestStatus)[keyof typeof MembershipRequestStatus];

export const MEMBERSHIP_REQUEST_STATUS_LABELS: Record<
  MembershipRequestStatus,
  string
> = {
  [MembershipRequestStatus.PENDING]: "Pending",
  [MembershipRequestStatus.APPROVED]: "Approved",
  [MembershipRequestStatus.DECLINED]: "Declined",
};

export interface MembershipRequest {
  id: string;
  fullName: string;
  serviceNumber: string;
  serviceNumberSuffix: string;
  phoneNumber: string;
  status: MembershipRequestStatus;
  submittedAt: Timestamp;
  reviewedAt?: Timestamp | null;
  reviewedById?: string | null;
  reviewedByName?: string | null;
  reviewRemarks?: string | null;
  memberId?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type SerializedMembershipRequest = Omit<
  MembershipRequest,
  "submittedAt" | "reviewedAt" | "createdAt" | "updatedAt"
> & {
  submittedAt: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
