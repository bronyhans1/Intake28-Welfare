import { z } from "zod";
import {
  PARENT_INFORMATION_OVERRIDE_REASONS,
  PARENT_STATUSES,
} from "@/types/parent-information";
import { validateParentInformationInput } from "@/lib/parent-information/validation";

const parentStatusField = z.union([
  z.enum(PARENT_STATUSES),
  z.literal(""),
]);

export const parentInformationFormSchema = z
  .object({
    motherFullName: z.string(),
    motherStatus: parentStatusField,
    fatherFullName: z.string(),
    fatherStatus: parentStatusField,
  })
  .superRefine((value, ctx) => {
    const result = validateParentInformationInput(value);
    if (result.success) return;

    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        if (!message) continue;
        ctx.addIssue({
          code: "custom",
          path: [field],
          message,
        });
      }
    }

    if (result.error) {
      ctx.addIssue({
        code: "custom",
        message: result.error,
      });
    }
  });

export const parentInformationOverrideSchema = parentInformationFormSchema.and(
  z
    .object({
      overrideReason: z.union([
        z.enum(PARENT_INFORMATION_OVERRIDE_REASONS),
        z.literal(""),
      ]),
      overrideReasonDetail: z.string().optional(),
    })
    .superRefine((value, ctx) => {
      if (!value.overrideReason) {
        ctx.addIssue({
          code: "custom",
          path: ["overrideReason"],
          message: "Reason for override is required.",
        });
        return;
      }

      if (value.overrideReason === "Other") {
        const detail = value.overrideReasonDetail?.trim() ?? "";
        if (!detail) {
          ctx.addIssue({
            code: "custom",
            path: ["overrideReasonDetail"],
            message: "Please describe the reason for this override.",
          });
        }
      }
    }),
);

export type ParentInformationFormSchemaInput = z.infer<
  typeof parentInformationFormSchema
>;
export type ParentInformationOverrideSchemaInput = z.infer<
  typeof parentInformationOverrideSchema
>;

export function resolveOverrideReasonText(input: {
  overrideReason: string;
  overrideReasonDetail?: string;
}): string {
  if (input.overrideReason === "Other") {
    return input.overrideReasonDetail?.trim() || "Other";
  }
  return input.overrideReason;
}
