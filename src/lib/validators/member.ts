import { z } from "zod";
import { Gender, UserRole, UserStatus } from "@/types/enums";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import { isValidServiceNumberSuffix } from "@/lib/utils/service-number";

const optionalGenderFieldSchema = z
  .union([z.literal(Gender.MALE), z.literal(Gender.FEMALE), z.literal("")])
  .optional();

const ghanaPhoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .transform(normalizePhoneNumber)
  .pipe(
    z.string().regex(/^0\d{9}$/, "Enter a valid Ghana phone number (e.g. 024XXXXXXX)"),
  );

const optionalDateOfBirthSchema = z
  .string()
  .optional()
  .refine(
    (value) => !value?.trim() || !Number.isNaN(Date.parse(value)),
    "Enter a valid date of birth",
  )
  .refine(
    (value) => !value?.trim() || new Date(value) <= new Date(),
    "Date of birth cannot be in the future",
  );

export const createMemberSchema = z.object({
  serviceNumberSuffix: z
    .string()
    .min(1, "Service number is required")
    .refine(isValidServiceNumberSuffix, {
      message: "Enter digits only (e.g. 13984)",
    }),
  fullName: z.string().min(2, "Full name is required"),
  phoneNumber: ghanaPhoneSchema,
  dateOfBirth: optionalDateOfBirthSchema,
  gender: optionalGenderFieldSchema,
  rank: z.string().optional(),
  station: z.string().optional(),
  role: z.enum([UserRole.ADMIN, UserRole.TREASURER, UserRole.MEMBER], {
    message: "Select a valid role",
  }),
  nextOfKin: z.string().optional(),
  emergencyContact: z.string().optional(),
});

export type CreateMemberFormInput = z.infer<typeof createMemberSchema>;

const requiredDateOfBirthSchema = z
  .string()
  .min(1, "Date of birth is required")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date of birth")
  .refine((value) => new Date(value) <= new Date(), "Date of birth cannot be in the future");

export const updateMemberSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phoneNumber: ghanaPhoneSchema,
  dateOfBirth: requiredDateOfBirthSchema,
  gender: optionalGenderFieldSchema,
  rank: z.string().min(1, "Rank is required"),
  station: z.string().min(1, "Station is required"),
  role: z.enum([UserRole.ADMIN, UserRole.TREASURER, UserRole.MEMBER], {
    message: "Select a valid role",
  }),
  status: z.enum(
    [UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.SUSPENDED, UserStatus.DEACTIVATED],
    { message: "Select a valid status" },
  ),
  nextOfKin: z.string().optional(),
  emergencyContact: z.string().optional(),
});

export type UpdateMemberFormInput = z.infer<typeof updateMemberSchema>;

export const memberListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10),
  search: z.string().optional(),
  role: z.enum([UserRole.ADMIN, UserRole.TREASURER, UserRole.MEMBER]).optional(),
  status: z
    .enum([UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.SUSPENDED, UserStatus.DEACTIVATED])
    .optional(),
  activationStatus: z.enum(["pending", "activated"]).optional(),
});

export type MemberListQuery = z.infer<typeof memberListQuerySchema>;
