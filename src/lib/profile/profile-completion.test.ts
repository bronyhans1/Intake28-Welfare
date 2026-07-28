import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { ActivationStatus, UserStatus } from "@/types/enums";
import type { User } from "@/types/user";
import { calculateProfileCompletion } from "./profile-completion";

const completeParents = {
  motherFullName: "Jane Doe",
  motherStatus: "alive" as const,
  fatherFullName: "John Doe",
  fatherStatus: "deceased" as const,
};

const baseUser = (overrides: Partial<User> = {}): User =>
  ({
    id: "user-1",
    serviceNumber: "IS/13984",
    serviceNumberSuffix: "13984",
    fullName: "John Doe",
    phoneNumber: "0241234567",
    email: "john@example.com",
    dateOfBirth: { seconds: 0, nanoseconds: 0 },
    rank: "Inspector",
    station: "HQ",
    profilePhotoUrl: "https://example.com/photo.jpg",
    profileCompleted: false,
    profileCompletionPercentage: 0,
    role: "member",
    status: UserStatus.ACTIVE,
    activationStatus: ActivationStatus.ACTIVATED,
    lastOtpSentAt: null,
    otpAttempts: 0,
    otpLockedUntil: null,
    activationOtpSentCount: 0,
    isDefaulter: false,
    consecutiveUnpaidMonths: 0,
    createdAt: { seconds: 0, nanoseconds: 0 },
    updatedAt: { seconds: 0, nanoseconds: 0 },
    ...overrides,
  }) as User;

describe("calculateProfileCompletion", () => {
  it("calculates progress for pending members based on saved fields", () => {
    const result = calculateProfileCompletion(
      baseUser({
        activationStatus: ActivationStatus.PENDING,
        nextOfKin: "Jane Doe",
        emergencyContact: "0249999999",
        ...completeParents,
      }),
    );

    expect(result.percentage).toBe(100);
    expect(result.isComplete).toBe(true);
    expect(result.missingFields).toEqual([]);
  });

  it("returns 100% when all required fields are present", () => {
    const result = calculateProfileCompletion(
      baseUser({
        nextOfKin: "Jane Doe",
        emergencyContact: "0249999999",
        ...completeParents,
      }),
    );

    expect(result.percentage).toBe(100);
    expect(result.isComplete).toBe(true);
    expect(result.missingFields).toEqual([]);
  });

  it("reports missing fields and partial percentage", () => {
    const result = calculateProfileCompletion(
      baseUser({
        email: null,
        rank: null,
        station: null,
        nextOfKin: undefined,
        emergencyContact: undefined,
        profilePhotoUrl: null,
      }),
    );

    expect(result.percentage).toBe(27);
    expect(result.isComplete).toBe(false);
    expect(result.missingFields).toEqual([
      "email",
      "rank",
      "station",
      "nextOfKin",
      "emergencyContact",
      "profilePhotoUrl",
      "motherInformation",
      "fatherInformation",
    ]);
  });

  it("returns 91% when ten of eleven fields are complete", () => {
    const result = calculateProfileCompletion(
      baseUser({
        nextOfKin: "Jane Doe",
        emergencyContact: "0249999999",
        email: null,
        ...completeParents,
      }),
    );

    expect(result.percentage).toBe(91);
    expect(result.missingFields).toEqual(["email"]);
  });

  it("detects admin Timestamp values for date of birth", () => {
    const result = calculateProfileCompletion(
      baseUser({
        dateOfBirth: Timestamp.fromDate(new Date("1990-01-01")),
        nextOfKin: "Jane Doe",
        emergencyContact: "0249999999",
        ...completeParents,
      }),
    );

    expect(result.percentage).toBe(100);
    expect(result.isComplete).toBe(true);
  });
});
