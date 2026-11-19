export const ReceiptAuditAction = {
  RECEIPT_GENERATED: "receipt_generated",
  RECEIPT_DOWNLOADED: "receipt_downloaded",
  RECEIPT_CANCELLED: "receipt_cancelled",
} as const;

export type ReceiptAuditAction =
  (typeof ReceiptAuditAction)[keyof typeof ReceiptAuditAction];
