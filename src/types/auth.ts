import type { Gender, UserRole } from "@/types/enums";

export const AUTH_SESSION_COOKIE = "gis_session" as const;
export const AUTH_ROLE_COOKIE = "gis_role" as const;
export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export interface CurrentUser {
  uid: string;
  fullName: string;
  serviceNumber: string;
  role: UserRole;
  profileCompleted: boolean;
  profileCompletionPercentage: number;
  profilePhotoUrl?: string | null;
  gender?: Gender | null;
}

export type EstablishSessionResult =
  | {
      success: true;
      redirectTo: string;
      user: CurrentUser;
    }
  | {
      success: false;
      error: string;
    };
