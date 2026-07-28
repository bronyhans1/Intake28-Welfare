import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClaimStatus, UserRole } from "@/types/enums";
import { ClaimsAuditAction } from "@/lib/claims/audit";
import { ELIGIBILITY_REASONS } from "@/lib/claims/eligibility-engine";
import {
  claimMatchesSearch,
  submitClaimDraft,
} from "@/lib/claims/claim-repository";

const mockCreateAuditLog = vi.fn();
const mockEvaluateEligibility = vi.fn();
const mockAllocateClaimNumber = vi.fn();
const mockUpdate = vi.fn();
const mockGet = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();

vi.mock("@/lib/audit/repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/claims/claim-progression", () => ({
  evaluateClaimSubmissionEligibility: (...args: unknown[]) =>
    mockEvaluateEligibility(...args),
  assertMemberEligibleToClaim: vi.fn(),
  buildClaimProgressionSnapshot: (input: {
    progression: Record<string, unknown>;
    recommendedAmount: number;
    claimCeiling: number;
  }) => ({
    welfarePoints: input.progression.welfarePoints,
    benefitPercentage: input.progression.benefitPercentage,
    membershipStatus: input.progression.membershipStatus,
    isMature: input.progression.isMature,
    eligibleToClaim: input.progression.eligibleToClaim,
    recommendedAmount: input.recommendedAmount,
    claimCeiling: input.claimCeiling,
    calculatedAt: "2026-07-26T10:00:00.000Z",
  }),
}));

vi.mock("@/lib/claims/claim-number", async () => {
  const actual = await vi.importActual<typeof import("@/lib/claims/claim-number")>(
    "@/lib/claims/claim-number",
  );
  return {
    ...actual,
    allocateClaimNumber: (...args: unknown[]) => mockAllocateClaimNumber(...args),
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
}));

vi.mock("@/lib/claims/claim-type-repository", () => ({
  getClaimTypeConfigByCode: vi.fn(),
}));

const actor = {
  uid: "member-1",
  fullName: "Member User",
  role: UserRole.MEMBER,
  serviceNumber: "IS/13984",
  email: "member@example.com",
};

const draftData = {
  reference: "DRAFT-CLAIM01",
  claimNumber: null,
  memberId: "member-1",
  memberName: "Member User",
  serviceNumber: "IS/13984",
  claimTypeCode: "medical",
  claimTypeDisplayName: "Medical",
  status: ClaimStatus.DRAFT,
  title: "Hospital visit",
  description: "Required surgery support",
  incidentDate: "2026-07-01",
  whatsappEvidenceNote: null,
  attachmentUrl: null,
  currency: "GHS",
  createdBy: "member-1",
  createdByName: "Member User",
  createdAt: { seconds: 1, nanoseconds: 0 },
  updatedAt: { seconds: 1, nanoseconds: 0 },
};

describe("claimMatchesSearch", () => {
  const claim = {
    title: "Hospital visit",
    description: "Surgery",
    reference: "GIS-2026-00015",
    claimNumber: "GIS-2026-00015",
    memberName: "Ama Mensah",
    serviceNumber: "IS/13984",
    claimTypeCode: "medical",
    claimTypeDisplayName: "Medical Assistance",
  };

  it("matches by claim number", () => {
    expect(claimMatchesSearch(claim, "GIS-2026-00015")).toBe(true);
    expect(claimMatchesSearch(claim, "00015")).toBe(true);
  });

  it("matches by member name", () => {
    expect(claimMatchesSearch(claim, "ama")).toBe(true);
    expect(claimMatchesSearch(claim, "nobody")).toBe(false);
  });

  it("matches by claim type", () => {
    expect(claimMatchesSearch(claim, "medical")).toBe(true);
    expect(claimMatchesSearch(claim, "Assistance")).toBe(true);
  });
});

describe("submitClaimDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue({ get: mockGet, update: mockUpdate });
    mockCollection.mockReturnValue({ doc: mockDoc });
    mockUpdate.mockResolvedValue(undefined);
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockAllocateClaimNumber.mockResolvedValue("GIS-2026-00001");
    mockGet.mockResolvedValue({
      exists: true,
      id: "claim-1",
      data: () => ({ ...draftData }),
    });
  });

  it("allows an eligible member to submit with permanent claim number and submitted status", async () => {
    mockEvaluateEligibility.mockResolvedValue({
      eligible: true,
      reasons: [],
      warnings: [],
      memberStatus: "ACTIVE",
      constitutionVersion: "2026 Constitution (2026.1)",
      benefitPercentage: 25,
      checks: [],
      waitingPeriodDays: 180,
      membershipDays: 400,
      welfarePoints: 6,
      isMature: true,
      eligibleToClaim: true,
      membershipProgressionStatus: "ACTIVE",
      recommendedAmount: 250,
      claimCeiling: 1000,
      progression: {
        memberId: "member-1",
        welfarePoints: 6,
        benefitPercentage: 25,
        membershipStatus: "ACTIVE",
        isMature: true,
        eligibleToClaim: true,
        successfulContributionMonths: 6,
        consecutiveContributionMonths: 6,
        consecutiveMissedMonths: 0,
        outstandingContributionMonths: 0,
        outstandingMonths: [],
        maturityDate: "2026-06-01T00:00:00.000Z",
        lastSuccessfulContributionDate: "2026-07-01T00:00:00.000Z",
        lastCalculatedAt: "2026-07-26T10:00:00.000Z",
      },
    });

    const result = await submitClaimDraft("claim-1", actor as never);

    expect(result).toEqual({
      claimId: "claim-1",
      claimNumber: "GIS-2026-00001",
    });
    expect(mockEvaluateEligibility).toHaveBeenCalledWith({
      memberId: "member-1",
      claimTypeCode: "medical",
    });
    expect(mockAllocateClaimNumber).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe(ClaimStatus.SUBMITTED);
    expect(payload.claimNumber).toBe("GIS-2026-00001");
    expect(payload.reference).toBe("GIS-2026-00001");
    expect(payload.recommendedAmount).toBe(250);
    expect(payload.progressionSnapshot).toMatchObject({
      welfarePoints: 6,
      benefitPercentage: 25,
      recommendedAmount: 250,
    });
    expect(payload.eligibilitySnapshot).toMatchObject({
      eligible: true,
      benefitPercentage: 25,
      constitutionVersion: "2026 Constitution (2026.1)",
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: ClaimsAuditAction.CLAIM_SUBMITTED,
        metadata: expect.objectContaining({ claimNumber: "GIS-2026-00001" }),
      }),
    );
  });

  it("rejects submission when the member is not eligible", async () => {
    mockEvaluateEligibility.mockResolvedValue({
      eligible: false,
      reasons: [ELIGIBILITY_REASONS.WAITING_PERIOD],
      warnings: [],
      memberStatus: "Active",
      constitutionVersion: "2026 Constitution (2026.1)",
      benefitPercentage: 75,
      checks: [],
      waitingPeriodDays: 365,
      membershipDays: 10,
    });

    await expect(submitClaimDraft("claim-1", actor as never)).rejects.toThrow(
      ELIGIBILITY_REASONS.WAITING_PERIOD,
    );
    expect(mockAllocateClaimNumber).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects submission when incident date is missing", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      id: "claim-1",
      data: () => ({ ...draftData, incidentDate: null }),
    });

    await expect(submitClaimDraft("claim-1", actor as never)).rejects.toThrow(
      /Incident date/,
    );
    expect(mockEvaluateEligibility).not.toHaveBeenCalled();
  });
});

describe("automatic eligibility on draft load", () => {
  it("reuses the eligibility engine for the selected claim type", async () => {
    const { evaluateMemberEligibility } = await import(
      "@/lib/claims/eligibility-engine"
    );
    const { UserStatus } = await import("@/types/enums");

    const result = evaluateMemberEligibility({
      member: {
        status: UserStatus.ACTIVE,
        isDefaulter: false,
        parentInformationCompleted: true,
        motherFullName: "Jane",
        motherStatus: "alive",
        fatherFullName: "John",
        fatherStatus: "alive",
        fullName: "Member",
        phoneNumber: "0241234567",
        email: "a@b.com",
        dateOfBirth: { seconds: 1, nanoseconds: 0 },
        rank: "Insp",
        station: "HQ",
        nextOfKin: "Kin",
        emergencyContact: "0249999999",
        profilePhotoUrl: "https://example.com/p.webp",
        activatedAt: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      claimTypeConfig: { waitingPeriodDays: 30, benefitPercentage: 50 },
      constitution: { displayName: "2026 Constitution", versionNumber: "2026.1" },
      asOf: new Date("2026-07-25T00:00:00.000Z"),
    });

    expect(result.eligible).toBe(true);
    expect(result.benefitPercentage).toBe(50);
  });
});
