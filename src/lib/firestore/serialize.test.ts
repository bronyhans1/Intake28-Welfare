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

  it("preserves Date and valid ISO strings", () => {
    expect(
      serializeTimestampValue(new Date("2026-08-01T08:30:00.000Z")),
    ).toBe("2026-08-01T08:30:00.000Z");
    expect(serializeTimestampValue("2026-08-01T08:30:00.000Z")).toBe(
      "2026-08-01T08:30:00.000Z",
    );
    expect(serializeTimestampValue(null)).toBeNull();
    expect(serializeTimestampValue("not-a-date")).toBeNull();
  });

  it("preserves nested auditHistory createdAt ISO strings", () => {
    const serialized = serializeFirestoreDoc("claim-1", {
      title: "Child Birth",
      auditHistory: [
        {
          id: "cae_1",
          type: "CLAIM_CREATED",
          title: "Claim Created",
          createdAt: "2026-08-20T15:00:00.000Z",
          reason: null,
          metadata: {},
        },
      ],
    });

    const history = serialized.auditHistory as Array<{ createdAt: string }>;
    expect(history[0].createdAt).toBe("2026-08-20T15:00:00.000Z");
  });
});
