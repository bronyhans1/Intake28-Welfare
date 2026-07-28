import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import {
  serializeFirestoreDoc,
  serializeTimestampValue,
} from "@/lib/firestore/serialize";

describe("serializeFirestoreDoc", () => {
  it("converts timestamp fields to ISO strings", () => {
    const createdAt = Timestamp.fromDate(new Date("2026-01-15T10:00:00.000Z"));

    const serialized = serializeFirestoreDoc("member-1", {
      fullName: "John Doe",
      gender: "male",
      createdAt,
      updatedAt: createdAt,
      activatedAt: null,
      lastOtpSentAt: null,
      otpLockedUntil: null,
      dateOfBirth: Timestamp.fromDate(new Date("1990-05-01")),
    });

    expect(serialized.id).toBe("member-1");
    expect(serialized.fullName).toBe("John Doe");
    expect(serialized.gender).toBe("male");
    expect(serialized.createdAt).toBe("2026-01-15T10:00:00.000Z");
    expect(serialized.updatedAt).toBe("2026-01-15T10:00:00.000Z");
    expect(serialized.activatedAt).toBeNull();
    expect(serialized.dateOfBirth).toBe("1990-05-01T00:00:00.000Z");
    expect(serializeTimestampValue(createdAt)).toBe("2026-01-15T10:00:00.000Z");
  });
});
