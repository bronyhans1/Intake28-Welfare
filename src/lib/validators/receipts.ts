import { z } from "zod";
import { ReceiptStatus } from "@/types/receipt";

export const receiptListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum([ReceiptStatus.ISSUED, ReceiptStatus.CANCELLED]).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).optional(),
  memberId: z.string().trim().optional(),
});

export type ReceiptListQuery = z.infer<typeof receiptListQuerySchema>;
