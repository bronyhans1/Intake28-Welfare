export const ReportAuditAction = {
  REPORT_EXPORTED: "report_exported",
} as const;

export type ReportAuditAction =
  (typeof ReportAuditAction)[keyof typeof ReportAuditAction];
