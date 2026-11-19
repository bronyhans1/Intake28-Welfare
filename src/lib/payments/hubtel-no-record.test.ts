import { describe, expect, it } from "vitest";
import {
  HUBTEL_NO_RECORD_SUPPRESS_MS,
  isHubtelNoRecordSuppressed,
} from "@/lib/payments/hubtel-no-record";

describe("isHubtelNoRecordSuppressed", () => {
  const now = new Date("2026-10-29T20:00:00.000Z");

  it("suppresses a recent definitive 4720 marker", () => {
    expect(
      isHubtelNoRecordSuppressed(
        {
          hubtelNoRecordCheckedAt: "2026-10-29T12:00:00.000Z",
          hubtelNoRecordResponseCode: "4720",
        },
        now,
      ),
    ).toBe(true);
  });

  it("does not suppress after the recheck window elapses", () => {
    const checkedAt = new Date(
      now.getTime() - HUBTEL_NO_RECORD_SUPPRESS_MS - 1_000,
    ).toISOString();
    expect(
      isHubtelNoRecordSuppressed(
        {
          hubtelNoRecordCheckedAt: checkedAt,
          hubtelNoRecordResponseCode: "4720",
        },
        now,
      ),
    ).toBe(false);
  });

  it("does not suppress when no marker exists", () => {
    expect(
      isHubtelNoRecordSuppressed(
        {
          hubtelNoRecordCheckedAt: null,
          hubtelNoRecordResponseCode: null,
        },
        now,
      ),
    ).toBe(false);
  });
});
