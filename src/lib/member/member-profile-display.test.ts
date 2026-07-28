import { describe, expect, it } from "vitest";
import { ActivationStatus, UserStatus } from "@/types/enums";
import { PROFILE_COMPLETION_FIELD_LABELS } from "@/lib/constants/profile-completion";
import {
  calculateProfileCompletion,
  toProfileCompletionContext,
} from "@/lib/utils/profile-completion";
import type { SerializedMember } from "@/types/user";

function sampleMember(
  overrides: Partial<SerializedMember> = {},
): SerializedMember {
  return {
    id: "member-1",
    serviceNumber: "IS/13984",
    serviceNumberSuffix: "13984",
    fullName: "Harrison Oduro",
    phoneNumber: "0241234567",
    email: "harrison@example.com",
    dateOfBirth: "1990-01-01T00:00:00.000Z",
    gender: null,
    rank: "Inspector",
    station: "HQ",
    nextOfKin: "Jane Oduro",
    emergencyContact: "0249999999",
    profilePhotoUrl: "https://example.com/photo.jpg",
    profileCompleted: false,
    profileCompletionPercentage: 75,
    role: "member",
    status: UserStatus.ACTIVE,
    activationStatus: ActivationStatus.ACTIVATED,
    lastOtpSentAt: null,
    otpLockedUntil: null,
    otpAttempts: 0,
    activationOtpSentCount: 0,
    isDefaulter: false,
    consecutiveUnpaidMonths: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("member profile completion display", () => {
  it("calculates partial completion when email, photo, and parents are missing", () => {
    const member = sampleMember({
      email: null,
      profilePhotoUrl: null,
      nextOfKin: undefined,
      emergencyContact: undefined,
    });

    const result = calculateProfileCompletion(toProfileCompletionContext(member));

    expect(result.profileCompletionPercentage).toBe(45);
    expect(result.missingFields).toEqual([
      "email",
      "nextOfKin",
      "emergencyContact",
      "profilePhotoUrl",
      "motherInformation",
      "fatherInformation",
    ]);
    expect(
      result.missingFields.map((field) => PROFILE_COMPLETION_FIELD_LABELS[field]),
    ).toEqual([
      "Email",
      "Beneficiary / Next of Kin",
      "Emergency Contact",
      "Profile Photo",
      "Mother Information",
      "Father Information",
    ]);
  });
});
