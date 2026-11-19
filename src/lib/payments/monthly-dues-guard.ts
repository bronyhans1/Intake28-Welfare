import { findPaidMonthlyDuesContribution } from "@/lib/contributions/repository";
import {
  formatMonthYearLabel,
  getCurrentMonthYear,
  monthYearKey,
  type MonthYear,
} from "@/lib/finance/period";
import { PaymentType } from "@/types/enums";

export function formatMonthlyDuesAlreadyPaidMessage(month: number, year: number): string {
  return `Your monthly dues for ${formatMonthYearLabel({ month, year })} have already been paid.`;
}

export interface MonthlyDuesPaymentGuardStatus {
  isPaid: boolean;
  month: number;
  year: number;
  message: string | null;
}

export async function getMonthlyDuesPaymentGuardStatus(
  memberId: string,
): Promise<MonthlyDuesPaymentGuardStatus> {
  const { month, year } = getCurrentMonthYear();
  const existing = await findPaidMonthlyDuesContribution(memberId, month, year);

  return {
    isPaid: Boolean(existing),
    month,
    year,
    message: existing ? formatMonthlyDuesAlreadyPaidMessage(month, year) : null,
  };
}

function normalizeSelectedMonths(selectedMonths: MonthYear[]): MonthYear[] {
  const unique = new Map<string, MonthYear>();
  for (const period of selectedMonths) {
    unique.set(monthYearKey(period), {
      month: period.month,
      year: period.year,
    });
  }
  return Array.from(unique.values()).sort((a, b) =>
    a.year === b.year ? a.month - b.month : a.year - b.year,
  );
}

/**
 * Blocks monthly-dues initialization when any selected month is already paid.
 * When no months are provided, falls back to the current business month
 * (legacy single-month behaviour).
 */
export async function assertMonthlyDuesPaymentAllowed(
  memberId: string,
  paymentType: PaymentType,
  selectedMonths?: MonthYear[],
): Promise<void> {
  if (paymentType !== PaymentType.MONTHLY_DUES) {
    return;
  }

  const periods =
    selectedMonths && selectedMonths.length > 0
      ? normalizeSelectedMonths(selectedMonths)
      : [getCurrentMonthYear()];

  for (const period of periods) {
    const existing = await findPaidMonthlyDuesContribution(
      memberId,
      period.month,
      period.year,
    );

    if (existing) {
      throw new Error(
        formatMonthlyDuesAlreadyPaidMessage(period.month, period.year),
      );
    }
  }
}

export { normalizeSelectedMonths };
