import { describe, expect, it } from "vitest";
import { ContributionStatus, ContributionType } from "@/types/enums";

describe("monthly dues filtering", () => {
  const records = [
    {
      memberId: "m1",
      contributionType: ContributionType.MONTHLY_DUES,
      status: ContributionStatus.PAID,
      month: 6,
      year: 2026,
      amount: 50,
    },
    {
      memberId: "m2",
      contributionType: ContributionType.SPECIAL_CONTRIBUTION,
      status: ContributionStatus.PAID,
      month: 6,
      year: 2026,
      amount: 200,
    },
    {
      memberId: "m3",
      contributionType: ContributionType.MONTHLY_DUES,
      status: ContributionStatus.PAID,
      month: 5,
      year: 2026,
      amount: 50,
    },
    {
      memberId: "m4",
      contributionType: ContributionType.MONTHLY_DUES,
      status: ContributionStatus.PENDING,
      month: 6,
      year: 2026,
      amount: 50,
    },
  ];

  function filterMonthlyDues(month: number, year: number) {
    return records.filter(
      (record) =>
        record.contributionType === ContributionType.MONTHLY_DUES &&
        record.status === ContributionStatus.PAID &&
        record.month === month &&
        record.year === year,
    );
  }

  it("includes only paid monthly dues for the target month", () => {
    const filtered = filterMonthlyDues(6, 2026);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.memberId).toBe("m1");
    expect(filtered[0]?.amount).toBe(50);
  });
});
