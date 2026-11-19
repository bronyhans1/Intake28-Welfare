import type { Timestamp } from "firebase-admin/firestore";
import type { ContributionType, SettingsCurrency } from "@/types/enums";

export const ReceiptStatus = {
  ISSUED: "issued",
  CANCELLED: "cancelled",
} as const;

export type ReceiptStatus = (typeof ReceiptStatus)[keyof typeof ReceiptStatus];

export interface Receipt {
  id: string;
  receiptNumber: string;
  paymentId: string;
  paymentReference: string;
  contributionId: string;
  memberId: string;
  memberName: string;
  serviceNumber: string;
  contributionType: ContributionType;
  amount: number;
  currency: SettingsCurrency;
  status: ReceiptStatus;
  issuedAt: Timestamp;
  issuedBy: string;
  createdAt: Timestamp;
}

export type SerializedReceipt = Omit<Receipt, "issuedAt" | "createdAt"> & {
  issuedAt: string;
  createdAt: string;
};
