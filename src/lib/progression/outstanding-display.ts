import { formatMonthYearLabel } from "@/lib/finance/period";
import type { OutstandingContributionMonth } from "@/types/membership-progression";

/** Executive-friendly month list: "June 2026 • July 2026" */
export function formatOutstandingMonthsDisplay(
  months: OutstandingContributionMonth[] | string[],
): string {
  if (months.length === 0) return "—";
  if (typeof months[0] === "string") {
    return (months as string[]).join(" • ");
  }
  return (months as OutstandingContributionMonth[])
    .map((period) => formatMonthYearLabel(period))
    .join(" • ");
}

export function resolveOutstandingBalance(
  monthsOwing: number,
  monthlyDuesAmount: number,
): number {
  return Number((Math.max(0, monthsOwing) * monthlyDuesAmount).toFixed(2));
}
