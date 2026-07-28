export interface MonthYear {
  month: number;
  year: number;
}

export function getCurrentMonthYear(timeZone = "Africa/Accra"): MonthYear {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "numeric",
    year: "numeric",
  });
  const parts = formatter.formatToParts(new Date());

  return {
    month: Number(parts.find((part) => part.type === "month")?.value ?? 1),
    year: Number(parts.find((part) => part.type === "year")?.value ?? new Date().getFullYear()),
  };
}

/**
 * Convert an ISO timestamp to the business contribution month
 * (calendar month of the event in Africa/Accra).
 */
export function toMonthKeyFromIsoDate(
  iso: string | null | undefined,
  timeZone = "Africa/Accra",
): MonthYear | null {
  if (!iso?.trim()) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "numeric",
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);

  return {
    month: Number(parts.find((part) => part.type === "month")?.value ?? 1),
    year: Number(parts.find((part) => part.type === "year")?.value ?? date.getFullYear()),
  };
}

export function compareMonthYear(a: MonthYear, b: MonthYear): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function isSameMonthYear(a: MonthYear, b: MonthYear): boolean {
  return a.year === b.year && a.month === b.month;
}

export function formatMonthYearLabel(period: MonthYear): string {
  return new Intl.DateTimeFormat("en-GH", {
    month: "long",
    year: "numeric",
  }).format(new Date(period.year, period.month - 1, 1));
}

export function monthYearKey(period: MonthYear): string {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

export function resolveTargetMonthYear(
  filters: { month?: number; year?: number } = {},
): MonthYear {
  if (filters.month && filters.year) {
    return { month: filters.month, year: filters.year };
  }

  return getCurrentMonthYear();
}
