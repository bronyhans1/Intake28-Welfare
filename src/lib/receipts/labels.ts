import { formatContributionTypeLabel } from "@/lib/contributions/labels";
import { ReceiptStatus } from "@/types/receipt";

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  [ReceiptStatus.ISSUED]: "Issued",
  [ReceiptStatus.CANCELLED]: "Cancelled",
};

export function formatReceiptStatusLabel(status: ReceiptStatus | string): string {
  return RECEIPT_STATUS_LABELS[status as ReceiptStatus] ?? status;
}

export function formatReceiptContributionTypeLabel(
  contributionType: string,
): string {
  return formatContributionTypeLabel(contributionType as never);
}
