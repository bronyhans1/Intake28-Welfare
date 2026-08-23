import { z } from "zod";

/** Stable support-type code: lowercase letter start, then letters/numbers/underscores. */
export const welfareSupportTypeCodeSchema = z
  .string()
  .trim()
  .min(2, "Code is required")
  .max(64, "Code is too long")
  .regex(
    /^[a-z][a-z0-9_]*$/,
    "Use lowercase letters, numbers, and underscores (e.g. funeral, medical_assistance)",
  );

export const createWelfareSupportTypeConfigSchema = z.object({
  code: welfareSupportTypeCodeSchema,
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(120, "Display name is too long"),
  description: z
    .string()
    .trim()
    .max(2000, "Description is too long")
    .optional()
    .transform((value) => value ?? ""),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(100),
});

export type CreateWelfareSupportTypeConfigInput = z.infer<
  typeof createWelfareSupportTypeConfigSchema
>;

export const updateWelfareSupportTypeConfigSchema =
  createWelfareSupportTypeConfigSchema.omit({ code: true });

export type UpdateWelfareSupportTypeConfigInput = z.infer<
  typeof updateWelfareSupportTypeConfigSchema
>;

export const welfareSupportTypeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  search: z.string().optional(),
  active: z
    .enum(["true", "false", "all"])
    .optional()
    .transform((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return undefined;
    }),
});

export type WelfareSupportTypeListQuery = z.infer<
  typeof welfareSupportTypeListQuerySchema
>;
