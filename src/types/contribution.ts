import type { Timestamp } from "firebase/firestore";
import type { ContributionSource, ContributionStatus, ContributionType } from "./enums";

export interface Contribution {
  id: string;
  memberId: string;
  memberName: string;
  serviceNumber: string;
  contributionType: ContributionType;
  amount: number;
  month: number;
  year: number;
  status: ContributionStatus;
  remarks?: string | null;
  recordedBy: string;
  recordedByName: string;
  contributionMonth: number;
  contributionYear: number;
  source?: ContributionSource | null;
  paymentReference?: string | null;
  paymentId?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Plain JSON record safe for Server → Client Component props */
export type SerializedContribution = Omit<
  Contribution,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export interface CreateContributionInput {
  memberId: string;
  memberName: string;
  serviceNumber: string;
  contributionType: ContributionType;
  amount: number;
  month: number;
  year: number;
  remarks?: string | null;
}

export interface UpdateContributionInput {
  contributionType: ContributionType;
  amount: number;
  remarks?: string | null;
}
