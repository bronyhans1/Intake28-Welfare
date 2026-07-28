import { COLLECTIONS } from "@/lib/constants";
import {
  getMonthlyDuesCollectedStats,
} from "@/lib/contributions/repository";
import { getAdminDb } from "@/lib/firebase/admin";
import { getMonthlyDuesAmount } from "@/lib/system-settings/repository";
import { UserStatus } from "@/types/enums";
import type { User } from "@/types/user";
import { resolveTargetMonthYear } from "@/lib/finance/period";

export interface ExpectedDuesSummary {
  activeMembers: number;
  monthlyDuesAmount: number;
  expectedAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  collectionRate: number;
}

export interface ExpectedDuesFilters {
  month?: number;
  year?: number;
}

function mapFirestoreUser(id: string, data: Record<string, unknown>): User {
  return { id, ...data } as User;
}

async function countActiveMembers(): Promise<number> {
  const db = getAdminDb();
  const snapshot = await db.collection(COLLECTIONS.USERS).get();

  return snapshot.docs
    .map((doc) => mapFirestoreUser(doc.id, doc.data() as Record<string, unknown>))
    .filter((user) => user.status === UserStatus.ACTIVE).length;
}

export function computeExpectedDuesSummary(input: {
  activeMembers: number;
  monthlyDuesAmount: number;
  collectedAmount: number;
}): ExpectedDuesSummary {
  const expectedAmount = input.activeMembers * input.monthlyDuesAmount;
  const outstandingAmount = expectedAmount - input.collectedAmount;
  const collectionRate =
    expectedAmount > 0
      ? Math.round((input.collectedAmount / expectedAmount) * 1000) / 10
      : 0;

  return {
    activeMembers: input.activeMembers,
    monthlyDuesAmount: input.monthlyDuesAmount,
    expectedAmount,
    collectedAmount: input.collectedAmount,
    outstandingAmount,
    collectionRate,
  };
}

export async function getExpectedDuesSummary(
  filters: ExpectedDuesFilters = {},
): Promise<ExpectedDuesSummary> {
  const { month, year } = resolveTargetMonthYear(filters);

  const [activeMembers, monthlyDuesAmount, monthlyDuesStats] = await Promise.all([
    countActiveMembers(),
    getMonthlyDuesAmount(),
    getMonthlyDuesCollectedStats({ month, year }),
  ]);

  return computeExpectedDuesSummary({
    activeMembers,
    monthlyDuesAmount,
    collectedAmount: monthlyDuesStats.collectedAmount,
  });
}
