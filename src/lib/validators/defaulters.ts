import { z } from "zod";

const MIN_YEAR = 2020;
const MAX_YEAR = new Date().getFullYear() + 1;

export const defaulterListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(10),
  search: z.string().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(MIN_YEAR).max(MAX_YEAR).optional(),
});

export type DefaulterListQuery = z.infer<typeof defaulterListQuerySchema>;
