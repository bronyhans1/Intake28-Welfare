import { describe, expect, it } from "vitest";
import {
  contributionListQuerySchema,
  createContributionSchema,
  updateContributionSchema,
} from "@/lib/validators/contributions";
import { ContributionStatus, ContributionType } from "@/types/enums";

const validCreate = {
  memberId: "uid123",
  memberName: "John Doe",
  serviceNumber: "IS/13984",
  contributionType: ContributionType.MONTHLY_DUES,
  amount: 50,
  month: 6,
  year: 2026,
  remarks: "Paid at meeting",
};

describe("createContributionSchema", () => {
  it("accepts valid input", () => {
    const result = createContributionSchema.safeParse(validCreate);
    expect(result.success).toBe(true);
  });

  it("rejects amount of 0", () => {
    const result = createContributionSchema.safeParse({ ...validCreate, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = createContributionSchema.safeParse({ ...validCreate, amount: -10 });
    expect(result.success).toBe(false);
  });

  it("rejects month outside 1-12", () => {
    expect(createContributionSchema.safeParse({ ...validCreate, month: 0 }).success).toBe(false);
    expect(createContributionSchema.safeParse({ ...validCreate, month: 13 }).success).toBe(false);
  });

  it("rejects invalid contribution type", () => {
    const result = createContributionSchema.safeParse({
      ...validCreate,
      contributionType: "invalid_type",
    });
    expect(result.success).toBe(false);
  });

  it("stores amount as a raw number (no currency symbols)", () => {
    const result = createContributionSchema.safeParse({ ...validCreate, amount: 1250.75 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.amount).toBe("number");
      expect(result.data.amount).toBe(1250.75);
    }
  });
});

describe("updateContributionSchema", () => {
  const validUpdate = {
    contributionType: ContributionType.SPECIAL_CONTRIBUTION,
    amount: 100,
    remarks: "Adjusted",
  };

  it("accepts valid input", () => {
    const result = updateContributionSchema.safeParse(validUpdate);
    expect(result.success).toBe(true);
  });

  it("rejects amount of 0", () => {
    const result = updateContributionSchema.safeParse({ ...validUpdate, amount: 0 });
    expect(result.success).toBe(false);
  });
});

describe("contributionListQuerySchema", () => {
  it("applies defaults", () => {
    const result = contributionListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(10);
    }
  });

  it("accepts valid filters", () => {
    const result = contributionListQuerySchema.safeParse({
      contributionType: ContributionType.WELFARE_FUND,
      status: ContributionStatus.PAID,
      month: 6,
      year: 2026,
      memberId: "uid123",
      search: "IS/13984",
    });
    expect(result.success).toBe(true);
  });
});

