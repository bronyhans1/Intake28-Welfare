import { describe, expect, it } from "vitest";
import {
  nextConstitutionVersionId,
  rulesetVersionFromConstitutionId,
  slugifyToInternalId,
} from "@/lib/utils/internal-id";
import { CLAIM_AMOUNT_MODE_LABELS, ClaimAmountMode } from "@/types/enums";

describe("slugifyToInternalId", () => {
  it("converts claim names into internal ids", () => {
    expect(slugifyToInternalId("Medical Assistance")).toBe("medical_assistance");
    expect(slugifyToInternalId("Parent Benefit")).toBe("parent_benefit");
    expect(slugifyToInternalId("  Emergency Relief  ")).toBe("emergency_relief");
    expect(slugifyToInternalId("Emergency Relief Fund")).toBe(
      "emergency_relief_fund",
    );
    expect(slugifyToInternalId("Medical Support")).toBe("medical_support");
  });
});

describe("nextConstitutionVersionId", () => {
  it("starts at constitution_v1", () => {
    expect(nextConstitutionVersionId([])).toBe("constitution_v1");
  });

  it("increments from existing constitution_vN ids", () => {
    expect(
      nextConstitutionVersionId(["constitution_v1", "constitution_v3"]),
    ).toBe("constitution_v4");
  });
});

describe("rulesetVersionFromConstitutionId", () => {
  it("derives a hidden ruleset id", () => {
    expect(rulesetVersionFromConstitutionId("constitution_v2")).toBe("rules_v2");
  });
});

describe("claim amount mode labels", () => {
  it("uses executive-friendly wording", () => {
    expect(CLAIM_AMOUNT_MODE_LABELS[ClaimAmountMode.FIXED]).toBe("Fixed Amount");
    expect(CLAIM_AMOUNT_MODE_LABELS[ClaimAmountMode.FORMULA]).toBe(
      "Percentage of Contribution",
    );
    expect(CLAIM_AMOUNT_MODE_LABELS[ClaimAmountMode.MANUAL]).toBe(
      "Executive Decision",
    );
  });
});
