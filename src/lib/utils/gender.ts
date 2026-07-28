import { Gender } from "@/types/enums";

const GENDER_VALUES = new Set<string>([Gender.MALE, Gender.FEMALE]);

export function normalizeGender(value: unknown): Gender | null {
  if (value === Gender.MALE || value === Gender.FEMALE) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (GENDER_VALUES.has(normalized)) {
      return normalized as Gender;
    }
  }

  return null;
}

export function formatGenderLabel(gender: Gender | null | undefined): string {
  if (gender === Gender.MALE) return "Male";
  if (gender === Gender.FEMALE) return "Female";
  return "—";
}
