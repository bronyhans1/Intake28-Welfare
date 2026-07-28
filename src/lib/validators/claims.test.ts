import { describe, expect, it } from "vitest";
import {
  claimDraftListQuerySchema,
  createClaimDraftSchema,
  createClaimTypeConfigSchema,
  createConstitutionDraftSchema,
} from "@/lib/validators/claims";
import { ClaimAmountMode, DuplicateRuleMode } from "@/types/enums";

describe("createClaimDraftSchema", () => {
  it("accepts a valid draft payload", () => {
    const parsed = createClaimDraftSchema.safeParse({
      claimTypeCode: "parent_benefit",
      title: "Parent benefit for mother",
      description: "Draft description",
      incidentDate: "2026-07-01",
      requestedAmount: 500,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid claim type codes", () => {
    const parsed = createClaimDraftSchema.safeParse({
      claimTypeCode: "Parent Benefit",
      title: "Title",
      description: "Description",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("createClaimTypeConfigSchema", () => {
  it("applies defaults for draft-friendly claim types", () => {
    const parsed = createClaimTypeConfigSchema.safeParse({
      code: "medical",
      displayName: "Medical Assistance",
      description: "Medical support claims",
      amountMode: ClaimAmountMode.MANUAL,
      waitingPeriodDays: 180,
      benefitPercentage: 75,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.allowDrafts).toBe(true);
      expect(parsed.data.active).toBe(true);
      expect(parsed.data.duplicateRules.mode).toBe(DuplicateRuleMode.NONE);
      expect(parsed.data.maxDocuments).toBe(10);
      expect(parsed.data.waitingPeriodDays).toBe(180);
      expect(parsed.data.benefitPercentage).toBe(75);
    }
  });

  it("allows claim types without a description", () => {
    const parsed = createClaimTypeConfigSchema.safeParse({
      code: "medical",
      displayName: "Medical Assistance",
      description: "",
      amountMode: ClaimAmountMode.MANUAL,
      waitingPeriodDays: 180,
      benefitPercentage: 75,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.description).toBe("");
    }
  });

  it("requires waiting period and benefit percentage", () => {
    const parsed = createClaimTypeConfigSchema.safeParse({
      code: "medical",
      displayName: "Medical Assistance",
      description: "Medical support claims",
      amountMode: ClaimAmountMode.MANUAL,
    });

    expect(parsed.success).toBe(false);
  });
});

describe("createConstitutionDraftSchema", () => {
  it("accepts payloads without manual internal ids", () => {
    const parsed = createConstitutionDraftSchema.safeParse({
      displayName: "GIS Intake 28 Welfare Constitution",
      versionNumber: "1.0",
      effectiveFrom: "2026-01-01",
      description: "Primary constitution for 2026",
    });

    expect(parsed.success).toBe(true);
  });

  it("requires a description", () => {
    const parsed = createConstitutionDraftSchema.safeParse({
      displayName: "GIS Intake 28 Welfare Constitution",
      versionNumber: "1.0",
      effectiveFrom: "2026-01-01",
      description: "",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects non ISO effectiveFrom values", () => {
    const parsed = createConstitutionDraftSchema.safeParse({
      id: "constitution_v1",
      displayName: "Constitution",
      versionNumber: "1.0",
      effectiveFrom: "01/01/2026",
      description: "Description",
      rulesetVersion: "rules_v1",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("claimDraftListQuerySchema", () => {
  it("defaults pagination", () => {
    const parsed = claimDraftListQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.pageSize).toBe(10);
    }
  });
});
