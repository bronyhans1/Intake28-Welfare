import { z } from "zod";
import { Gender } from "@/types/enums";
import { normalizePhoneNumber } from "@/lib/utils/phone";

const optionalGenderFieldSchema = z
  .union([z.literal(Gender.MALE), z.literal(Gender.FEMALE), z.literal("")])
  .optional();

const optionalEmailFieldSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || z.string().email().safeParse(value.toLowerCase()).success,
    "Enter a valid email address",
  );

const ghanaPhoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .transform(normalizePhoneNumber)
  .pipe(
    z.string().regex(/^0\d{9}$/, "Enter a valid Ghana phone number (e.g. 024XXXXXXX)"),
  );

const requiredDateOfBirthSchema = z
  .string()
  .min(1, "Date of birth is required")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date of birth")
  .refine((value) => new Date(value) <= new Date(), "Date of birth cannot be in the future");

export const updateProfileSchema = z.object({
  email: optionalEmailFieldSchema,
  dateOfBirth: requiredDateOfBirthSchema,
  gender: optionalGenderFieldSchema,
  rank: z.string().min(1, "Rank is required"),
  station: z.string().min(1, "Station is required"),
  nextOfKin: z.string().optional(),
  emergencyContact: z.string().optional(),
});

export { ghanaPhoneSchema };

export const profilePhotoUpdateSchema = z.object({
  profilePhotoUrl: z.string().url("Invalid profile photo URL"),
  profilePhotoPath: z.string().min(1, "Profile photo path is required"),
});

export type UpdateProfileFormInput = z.infer<typeof updateProfileSchema>;
export type ProfilePhotoUpdateInput = z.infer<typeof profilePhotoUpdateSchema>;
