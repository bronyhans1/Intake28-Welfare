import type { Timestamp } from "firebase/firestore";

function toDateValue(
  value: Timestamp | Date | string | null | undefined,
): Date | null {
  if (!value) return null;

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object" && "toDate" in value) {
    const date = (value as Timestamp).toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export function formatDisplayDate(
  value: Timestamp | Date | string | null | undefined,
): string {
  const date = toDateValue(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Africa/Accra",
  }).format(date);
}

/** Long form for formal documents, e.g. "01 January 2026". */
export function formatLongDisplayDate(
  value: Timestamp | Date | string | null | undefined,
): string {
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (match) {
      const date = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
      );
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(date);
    }
  }

  const date = toDateValue(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Accra",
  }).format(date);
}

export function formatInputDate(
  value: Timestamp | Date | string | null | undefined,
): string {
  const date = toDateValue(value);
  if (!date) return "";

  return date.toISOString().slice(0, 10);
}
