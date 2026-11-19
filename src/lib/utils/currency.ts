/**
 * Currency formatting utilities.
 * Amounts are stored as raw numbers in Firestore — never with currency symbols.
 * This module handles display-only formatting.
 */

const DEFAULT_CURRENCY = "GHS";

const GHANA_NUMBER_FORMATTER = new Intl.NumberFormat("en-GH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export interface FormatCurrencyOptions {
  currency?: string;
  locale?: string;
}

/**
 * Formats a numeric amount for display.
 * Amounts must be stored as numbers only in Firestore.
 *
 * @example
 * formatCurrency(500)        → "GHS 500.00"
 * formatCurrency(1250.75)    → "GHS 1,250.75"
 */
export function formatCurrency(
  amount: number,
  options: FormatCurrencyOptions = {},
): string {
  const { currency = DEFAULT_CURRENCY } = options;

  const formatted = GHANA_NUMBER_FORMATTER.format(amount);

  return `${currency} ${formatted}`;
}

export function parseAmount(value: string): number | null {
  const stripped = value.replace(/[^0-9.]/g, "");
  if (!stripped) return null;

  const parsed = Number(stripped);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return parsed;
}
