import { resolveCheckoutAmountBreakdown } from "@/lib/payments/checkout-amount";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

type HubtelCheckoutBreakdownProps = {
  /** Official welfare contribution total for this checkout. */
  officialAmount: number;
  className?: string;
};

/**
 * Member-facing contribution total before Hubtel redirect.
 *
 * Matches the deployed summary: a single “Total …” line using the official
 * welfare contribution. Does not display the 2% fee or gross Hubtel checkout
 * amount — those remain server-side for init/verification.
 */
export function HubtelCheckoutBreakdown({
  officialAmount,
  className,
}: HubtelCheckoutBreakdownProps) {
  if (!Number.isFinite(officialAmount) || officialAmount <= 0) {
    return null;
  }

  // Shared helper keeps the displayed official amount aligned with server
  // persistence; fee / checkoutAmount are intentionally not shown.
  const { amount } = resolveCheckoutAmountBreakdown(officialAmount);

  return (
    <p
      className={cn(
        "mt-3 text-base font-semibold text-foreground",
        className,
      )}
    >
      Total {formatCurrency(amount)}
    </p>
  );
}
