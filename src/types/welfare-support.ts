import type { Timestamp } from "firebase/firestore";
import type { WelfareSupportStatus, WelfareSupportType } from "./enums";

export interface WelfareSupport {
  id: string;

  /** Member snapshot — stored at creation time */
  memberId: string;
  memberName: string;
  serviceNumber: string;

  supportType: WelfareSupportType;

  /** Raw numeric amount — never store currency symbols */
  amount: number;

  description: string;

  status: WelfareSupportStatus;

  /** Admin who approved the support */
  approvedBy: string;
  approvedByName: string;

  /** Admin who recorded the support */
  recordedBy: string;
  recordedByName: string;

  /** Reporting fields — auto-generated from createdAt, never editable */
  supportYear: number;
  supportMonth: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Plain JSON record safe for Server → Client Component props */
export type SerializedWelfareSupport = Omit<WelfareSupport, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};
