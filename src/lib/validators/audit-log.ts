import { z } from "zod";

export const auditLogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  search: z.string().optional(),
  action: z.string().optional(),
  actor: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>;
