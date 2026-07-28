import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import {
  calculateProfileCompletion,
  type ProfileCompletionUser,
} from "./profile-completion";

function buildProfileSnapshotFromEditInput(input: {
  fullName: string;
  phoneNumber: string;
  email?: string;
  dateOfBirth: string;
  rank: string;
  station: string;
  nextOfKin?: string;
  emergencyContact?: string;
  profilePhotoUrl?: string | null;
  motherFullName?: string | null;
  motherStatus?: "alive" | "deceased" | null;
  fatherFullName?: string | null;
  fatherStatus?: "alive" | "deceased" | null;
}): ProfileCompletionUser {
  return {
    fullName: input.fullName.trim(),
    phoneNumber: input.phoneNumber,
    email: input.email?.trim() || null,
    dateOfBirth: Timestamp.fromDate(new Date(input.dateOfBirth)),
    rank: input.rank.trim(),
    station: input.station.trim(),
    nextOfKin: input.nextOfKin?.trim() || null,
    emergencyContact: input.emergencyContact?.trim() || null,
    profilePhotoUrl: input.profilePhotoUrl ?? null,
    motherFullName: input.motherFullName ?? null,
    motherStatus: input.motherStatus ?? null,
    fatherFullName: input.fatherFullName ?? null,
    fatherStatus: input.fatherStatus ?? null,
  };
}

describe("updateMember profileSnapshot simulation", () => {
  it("returns 100% when all required fields including parents are present", () => {
    const snapshot = buildProfileSnapshotFromEditInput({
      fullName: "Harrison Oduro",
      phoneNumber: "0241234567",
      email: "harrison@example.com",
      dateOfBirth: "1990-05-15",
      rank: "Inspector",
      station: "HQ",
      nextOfKin: "Jane Oduro",
      emergencyContact: "0249999999",
      profilePhotoUrl: "https://example.com/photo.jpg",
      motherFullName: "Mary Oduro",
      motherStatus: "alive",
      fatherFullName: "Kwame Oduro",
      fatherStatus: "deceased",
    });

    const result = calculateProfileCompletion(snapshot);

    expect(result.percentage).toBe(100);
    expect(result.isComplete).toBe(true);
    expect(result.missingFields).toEqual([]);
  });

  it("returns partial progress when email, photo, and parents are empty", () => {
    const snapshot = buildProfileSnapshotFromEditInput({
      fullName: "Harrison Oduro",
      phoneNumber: "0241234567",
      dateOfBirth: "1990-05-15",
      rank: "Inspector",
      station: "HQ",
    });

    const result = calculateProfileCompletion(snapshot);

    expect(result.percentage).toBe(45);
    expect(result.isComplete).toBe(false);
    expect(result.missingFields).toEqual([
      "email",
      "nextOfKin",
      "emergencyContact",
      "profilePhotoUrl",
      "motherInformation",
      "fatherInformation",
    ]);
  });

  it("does not return 0% when rank, station, and dob are saved", () => {
    const snapshot = buildProfileSnapshotFromEditInput({
      fullName: "Harrison Oduro",
      phoneNumber: "0241234567",
      dateOfBirth: "1990-05-15",
      rank: "Inspector",
      station: "HQ",
    });

    expect(calculateProfileCompletion(snapshot).percentage).toBeGreaterThan(0);
  });
});
