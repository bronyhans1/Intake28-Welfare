import type { Timestamp } from "firebase-admin/firestore";

export const PhoneVerificationStatus = {
  PENDING: "pending",
  VERIFIED: "verified",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
} as const;

export type PhoneVerificationStatus =
  (typeof PhoneVerificationStatus)[keyof typeof PhoneVerificationStatus];

export interface PhoneVerification {
  id: string;
  memberId: string;
  serviceNumber: string;
  currentPhone: string;
  newPhone: string;
  otpCode: string;
  status: PhoneVerificationStatus;
  attemptCount: number;
  resendCount: number;
  expiresAt: Timestamp;
  verifiedAt: Timestamp | null;
  createdAt: Timestamp;
  createdBy: string;
}

export interface SerializedPhoneVerification {
  id: string;
  memberId: string;
  serviceNumber: string;
  currentPhone: string;
  newPhone: string;
  status: PhoneVerificationStatus;
  attemptCount: number;
  resendCount: number;
  expiresAt: string;
  verifiedAt: string | null;
  createdAt: string;
}
