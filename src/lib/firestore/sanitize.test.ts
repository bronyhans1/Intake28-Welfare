import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import {
  normalizeMemberFieldValue,
  sanitizeAuditChanges,
  sanitizeFirestoreData,
} from "./sanitize";

describe("sanitizeFirestoreData", () => {
  it("omits undefined fields", () => {
    const result = sanitizeFirestoreData({
      fullName: "Jane Doe",
      nextOfKin: undefined,
      emergencyContact: undefined,
    });

    expect(result).toEqual({ fullName: "Jane Doe" });
    expect("nextOfKin" in result).toBe(false);
    expect("emergencyContact" in result).toBe(false);
  });

  it("preserves null and primitive values", () => {
    const result = sanitizeFirestoreData({
      nextOfKin: null,
      otpAttempts: 0,
      isDefaulter: false,
    });

    expect(result).toEqual({
      nextOfKin: null,
      otpAttempts: 0,
      isDefaulter: false,
    });
  });

  it("converts NaN and Infinity to null", () => {
    const result = sanitizeFirestoreData({
      activationOtpSentCount: Number.NaN,
      profileCompletionPercentage: Number.POSITIVE_INFINITY,
      otpAttempts: 2,
    });

    expect(result).toEqual({
      activationOtpSentCount: null,
      profileCompletionPercentage: null,
      otpAttempts: 2,
    });
  });

  it("preserves Firestore write values", () => {
    const timestamp = Timestamp.fromDate(new Date("2024-01-01"));
    const result = sanitizeFirestoreData({
      dateOfBirth: timestamp,
      updatedAt: FieldValue.serverTimestamp(),
      fullName: "Jane Doe",
    });

    expect(result.dateOfBirth).toBe(timestamp);
    expect(result.updatedAt).toBeInstanceOf(FieldValue);
  });

  it("sanitizes nested objects", () => {
    const result = sanitizeFirestoreData({
      metadata: {
        note: "ok",
        optional: undefined,
      },
    });

    expect(result).toEqual({ metadata: { note: "ok" } });
  });
});

describe("sanitizeAuditChanges", () => {
  it("replaces undefined before/after values with null", () => {
    const result = sanitizeAuditChanges({
      rank: {
        before: undefined,
        after: "Captain",
      },
    });

    expect(result).toEqual({
      rank: {
        before: null,
        after: "Captain",
      },
    });
  });

  it("converts invalid numbers to null", () => {
    const result = sanitizeAuditChanges({
      activationOtpSentCount: {
        before: Number.NaN,
        after: 1,
      },
    });

    expect(result).toEqual({
      activationOtpSentCount: {
        before: null,
        after: 1,
      },
    });
  });

  it("omits changes where both values sanitize to null", () => {
    const result = sanitizeAuditChanges({
      rank: {
        before: undefined,
        after: undefined,
      },
    });

    expect(result).toEqual({});
  });
});

describe("normalizeMemberFieldValue", () => {
  it("normalizes counter fields with safeNumber", () => {
    expect(normalizeMemberFieldValue("activationOtpSentCount", undefined)).toBe(0);
    expect(normalizeMemberFieldValue("activationOtpSentCount", Number.NaN)).toBe(0);
    expect(normalizeMemberFieldValue("activationOtpSentCount", 3)).toBe(3);
  });

  it("normalizes optional string fields to null when empty", () => {
    expect(normalizeMemberFieldValue("rank", undefined)).toBeNull();
    expect(normalizeMemberFieldValue("rank", "  ")).toBeNull();
    expect(normalizeMemberFieldValue("rank", " Captain ")).toBe("Captain");
  });

  it("normalizes gender values", () => {
    expect(normalizeMemberFieldValue("gender", undefined)).toBeNull();
    expect(normalizeMemberFieldValue("gender", "male")).toBe("male");
    expect(normalizeMemberFieldValue("gender", "Female")).toBe("female");
    expect(normalizeMemberFieldValue("gender", "invalid")).toBeNull();
  });
});
