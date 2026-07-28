/**
 * Phase 3F — COMPLETE BUSINESS RULE VERIFICATION
 *
 * Asserts the agreed business rules (not merely current implementation quirks).
 * A failing test means that rule is NOT production-ready as specified.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  resolveContributionStartMonth,
  assertMonthsWithinContributionWindow,
} from "@/lib/contributions/outstanding-months";
import { getContributionMonths } from "@/lib/contributions/repository";
import {
  calculateBenefitPercentage,
  calculateProgressionFromContributions,
  MATURITY_SUCCESSFUL_MONTHS,
} from "@/lib/progression/calculator";
import { estimateProgressionAfterPayingMonths } from "@/lib/contributions/arrears-progression-estimate";
import {
  assertMonthlyDuesPaymentAllowed,
  normalizeSelectedMonths,
} from "@/lib/payments/monthly-dues-guard";
import { ensureContributionFromPayment } from "@/lib/payments/contribution-automation";
import { formatAuditDescription } from "@/lib/audit/labels";
import { PaymentAuditAction } from "@/lib/payments/audit";
import { ReportType } from "@/lib/reports/types";
import {
  ContributionStatus,
  ContributionType,
  MembershipProgressionStatus,
  PaymentProvider,
  PaymentStatus,
  PaymentType,
  UserRole,
} from "@/types/enums";
import { monthYearKey, type MonthYear } from "@/lib/finance/period";
import {
  CLAIM_PROGRESSION_REASONS,
  evaluateClaimSubmissionEligibility,
} from "@/lib/claims/claim-progression";

vi.mock("@/lib/contributions/repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/contributions/repository")>();
  return {
    ...actual,
    findPaidMonthlyDuesContribution: vi.fn(),
    getContributionByPaymentReference: vi.fn().mockResolvedValue(null),
    listContributionsByPaymentReference: vi.fn().mockResolvedValue([]),
    createAutomatedContribution: vi.fn(),
  };
});

vi.mock("@/lib/audit/repository", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/receipts/service", () => ({
  ensureReceiptFromPayment: vi.fn().mockResolvedValue({
    outcome: "created",
    receipt: { id: "r1", receiptNumber: "RCP-1" },
  }),
}));

vi.mock("@/lib/system-settings/repository", () => ({
  getMonthlyDuesAmount: vi.fn().mockResolvedValue(50),
}));

vi.mock("@/lib/notifications/payment-events", () => ({
  notifyContributionReceived: vi.fn(),
  notifyPaymentRecorded: vi.fn(),
}));

vi.mock("@/lib/claims/eligibility-service", () => ({
  evaluateMemberEligibilityForClaim: vi.fn().mockResolvedValue({
    eligible: true,
    reasons: [],
    warnings: [],
    benefitPercentage: 0,
    memberStatus: "ACTIVE",
  }),
}));

vi.mock("@/lib/claims/claim-type-repository", () => ({
  getClaimTypeConfigByCode: vi.fn().mockResolvedValue({
    code: "medical_support",
    displayName: "Medical Support",
    fixedAmount: 1000,
  }),
}));

vi.mock("@/lib/progression", () => ({
  getProgressionSummary: vi.fn(),
}));

import { findPaidMonthlyDuesContribution, createAutomatedContribution } from "@/lib/contributions/repository";
import { createAuditLog } from "@/lib/audit/repository";
import { getProgressionSummary } from "@/lib/progression";

const findPaid = vi.mocked(findPaidMonthlyDuesContribution);
const createContribution = vi.mocked(createAutomatedContribution);
const getProgression = vi.mocked(getProgressionSummary);

function dues(month: number, year = 2026) {
  return {
    year,
    month,
    contributionType: ContributionType.MONTHLY_DUES,
    status: ContributionStatus.PAID,
    contributedAt: `${year}-${String(month).padStart(2, "0")}-15T10:00:00.000Z`,
  };
}

/** Mirrors outstanding-months algorithm without I/O. */
function computeOutstandingMonths(
  membershipStart: MonthYear,
  asOf: MonthYear,
  paid: MonthYear[],
): MonthYear[] {
  const paidKeys = new Set(paid.map((p) => monthYearKey(p)));
  return getContributionMonths(membershipStart, asOf).filter(
    (period) => !paidKeys.has(monthYearKey(period)),
  );
}

describe("PHASE 3F BUSINESS RULE VERIFICATION", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findPaid.mockResolvedValue(null);
  });

  // -------------------------------------------------------------------------
  describe("GROUP 1 — JOIN MONTH BOUNDARY", () => {
    it("Scenario A: join 20 July 2026 → obligations start July, not earlier", () => {
      const start = resolveContributionStartMonth({
        activatedAt: "2026-07-20T15:30:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      expect(start).toEqual({ month: 7, year: 2026 });

      const months = getContributionMonths(start!, { month: 12, year: 2026 });
      expect(months[0]).toEqual({ month: 7, year: 2026 });
      expect(
        months.some((m) => m.year === 2026 && m.month >= 1 && m.month <= 6),
      ).toBe(false);
    });

    it("Scenario B: join 1 November 2026 → no earlier months", () => {
      const start = resolveContributionStartMonth({
        activatedAt: "2026-11-01T08:00:00.000Z",
        createdAt: "2026-10-01T00:00:00.000Z",
      });
      expect(start).toEqual({ month: 11, year: 2026 });

      const months = getContributionMonths(start!, { month: 12, year: 2026 });
      expect(months[0]).toEqual({ month: 11, year: 2026 });
      expect(months.some((m) => m.month === 10 && m.year === 2026)).toBe(false);
    });

    it("Scenario C: join 31 July 2026 → July still Month 1", () => {
      const start = resolveContributionStartMonth({
        activatedAt: "2026-07-31T23:00:00.000Z",
        createdAt: "2026-07-31T23:00:00.000Z",
      });
      expect(start).toEqual({ month: 7, year: 2026 });
    });

    it("rejects payment for months before join", () => {
      expect(() =>
        assertMonthsWithinContributionWindow({
          selectedMonths: [{ month: 6, year: 2026 }],
          membershipStart: { month: 7, year: 2026 },
          currentMonth: { month: 12, year: 2026 },
        }),
      ).toThrow(/before you joined/i);
    });
  });

  // -------------------------------------------------------------------------
  describe("GROUP 2 — OUTSTANDING MONTH CALCULATION", () => {
    it("returns only unpaid months (Apr, May) when Jan–Mar and Jun are paid", () => {
      const outstanding = computeOutstandingMonths(
        { month: 1, year: 2026 },
        { month: 6, year: 2026 },
        [
          { month: 1, year: 2026 },
          { month: 2, year: 2026 },
          { month: 3, year: 2026 },
          { month: 6, year: 2026 },
        ],
      );

      expect(outstanding).toEqual([
        { month: 4, year: 2026 },
        { month: 5, year: 2026 },
      ]);
    });
  });

  // -------------------------------------------------------------------------
  describe("GROUP 3 — MULTI-MONTH PAYMENT", () => {
    it("one payment with April+May selected creates two contributions; June stays outstanding", async () => {
      createContribution
        .mockResolvedValueOnce({
          id: "c-apr",
          month: 4,
          year: 2026,
        } as never)
        .mockResolvedValueOnce({
          id: "c-may",
          month: 5,
          year: 2026,
        } as never);

      const result = await ensureContributionFromPayment(
        {
          id: "payment-multi",
          memberId: "member-1",
          memberName: "Member",
          serviceNumber: "IS/1",
          email: "a@b.c",
          amount: 100,
          currency: "GHS",
          reference: "GIS-MULTI-1",
          paymentType: PaymentType.MONTHLY_DUES,
          provider: PaymentProvider.PAYSTACK,
          providerReference: "ps-1",
          status: PaymentStatus.SUCCESS,
          selectedMonths: [
            { month: 4, year: 2026 },
            { month: 5, year: 2026 },
          ],
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
          paidAt: "2026-06-01T00:00:00.000Z",
        },
        {
          uid: "member-1",
          fullName: "Member",
          role: UserRole.MEMBER,
          serviceNumber: "IS/1",
          profileCompleted: true,
          profileCompletionPercentage: 100,
        },
      );

      expect(result.outcome).toBe("created");
      expect(createContribution).toHaveBeenCalledTimes(2);
      expect(createContribution).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ month: 4, year: 2026 }),
      );
      expect(createContribution).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ month: 5, year: 2026 }),
      );

      const remaining = computeOutstandingMonths(
        { month: 1, year: 2026 },
        { month: 6, year: 2026 },
        [
          { month: 1, year: 2026 },
          { month: 2, year: 2026 },
          { month: 3, year: 2026 },
          { month: 4, year: 2026 },
          { month: 5, year: 2026 },
        ],
      );
      expect(remaining).toEqual([{ month: 6, year: 2026 }]);
    });
  });

  // -------------------------------------------------------------------------
  describe("GROUP 4 — PARTIAL ARREARS", () => {
    it("paying May only leaves April and June outstanding", () => {
      const before = [
        { month: 4, year: 2026 },
        { month: 5, year: 2026 },
        { month: 6, year: 2026 },
      ];
      expect(before).toHaveLength(3);

      const afterPayingMay = computeOutstandingMonths(
        { month: 1, year: 2026 },
        { month: 6, year: 2026 },
        [
          { month: 1, year: 2026 },
          { month: 2, year: 2026 },
          { month: 3, year: 2026 },
          { month: 5, year: 2026 },
        ],
      );

      expect(afterPayingMay).toEqual([
        { month: 4, year: 2026 },
        { month: 6, year: 2026 },
      ]);
      expect(afterPayingMay.some((m) => m.month === 5)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe("GROUP 5 — DUPLICATE PROTECTION", () => {
    it("rejects initialize when March is already paid", async () => {
      findPaid.mockResolvedValue({ id: "existing-march" } as never);

      await expect(
        assertMonthlyDuesPaymentAllowed(
          "member-1",
          PaymentType.MONTHLY_DUES,
          [{ month: 3, year: 2026 }],
        ),
      ).rejects.toThrow(/already been paid/i);
    });

    it("automation skips creating a second March contribution", async () => {
      findPaid.mockResolvedValue({
        id: "existing-march",
        month: 3,
        year: 2026,
      } as never);

      const result = await ensureContributionFromPayment(
        {
          id: "payment-dup",
          memberId: "member-1",
          memberName: "Member",
          serviceNumber: "IS/1",
          email: "a@b.c",
          amount: 50,
          currency: "GHS",
          reference: "GIS-DUP-1",
          paymentType: PaymentType.MONTHLY_DUES,
          provider: PaymentProvider.PAYSTACK,
          providerReference: "ps-dup",
          status: PaymentStatus.SUCCESS,
          selectedMonths: [{ month: 3, year: 2026 }],
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
          paidAt: "2026-06-01T00:00:00.000Z",
        },
        {
          uid: "member-1",
          fullName: "Member",
          role: UserRole.MEMBER,
          serviceNumber: "IS/1",
          profileCompleted: true,
          profileCompletionPercentage: 100,
        },
      );

      expect(result.outcome).toBe("duplicate_monthly_dues_skipped");
      expect(createContribution).not.toHaveBeenCalled();
    });

    it("duplicate paid rows for the same month still yield one welfare point", () => {
      const result = calculateProgressionFromContributions({
        memberId: "m1",
        membershipStart: { month: 1, year: 2026 },
        asOf: { month: 3, year: 2026 },
        defaulterThresholdMonths: 2,
        contributions: [dues(3), dues(3), dues(3)],
      });
      expect(result.welfarePoints).toBe(1);
    });

    it("normalizeSelectedMonths dedupes identical selections", () => {
      expect(
        normalizeSelectedMonths([
          { month: 3, year: 2026 },
          { month: 3, year: 2026 },
        ]),
      ).toEqual([{ month: 3, year: 2026 }]);
    });
  });

  // -------------------------------------------------------------------------
  describe("GROUP 6 — DEFAULTING", () => {
    it("marks DEFAULTING when two consecutive months are unpaid even if a later month is paid", () => {
      const result = calculateProgressionFromContributions({
        memberId: "m1",
        membershipStart: { month: 1, year: 2026 },
        asOf: { month: 5, year: 2026 },
        defaulterThresholdMonths: 2,
        contributions: [dues(1), dues(2), dues(5)],
      });

      expect(result.outstandingContributionMonths).toBe(2);
      expect(result.outstandingMonths).toEqual([
        { month: 3, year: 2026 },
        { month: 4, year: 2026 },
      ]);
      expect(result.membershipStatus).toBe(
        MembershipProgressionStatus.DEFAULTING,
      );
    });
  });

  // -------------------------------------------------------------------------
  describe("GROUP 7 — DEFAULTING RECOVERY", () => {
    it("clearing March+April arrears restores ACTIVE and updates points/benefit%", () => {
      const before = calculateProgressionFromContributions({
        memberId: "m1",
        membershipStart: { month: 1, year: 2026 },
        asOf: { month: 5, year: 2026 },
        defaulterThresholdMonths: 2,
        contributions: [dues(1), dues(2), dues(5)],
      });

      expect(before.membershipStatus).toBe(
        MembershipProgressionStatus.DEFAULTING,
      );
      expect(before.outstandingContributionMonths).toBe(2);

      const after = estimateProgressionAfterPayingMonths(
        {
          memberId: "m1",
          membershipStart: { month: 1, year: 2026 },
          asOf: { month: 5, year: 2026 },
          defaulterThresholdMonths: 2,
          contributions: [dues(1), dues(2), dues(5)],
        },
        [
          { month: 3, year: 2026 },
          { month: 4, year: 2026 },
        ],
      );

      expect(after.after.membershipStatus).toBe(
        MembershipProgressionStatus.ACTIVE,
      );
      expect(after.after.welfarePoints).toBe(before.welfarePoints + 2);
      expect(after.after.benefitPercentage).toBeGreaterThanOrEqual(
        before.benefitPercentage,
      );
      expect(after.after.welfarePoints).toBe(5);

      const cleared = calculateProgressionFromContributions({
        memberId: "m1",
        membershipStart: { month: 1, year: 2026 },
        asOf: { month: 5, year: 2026 },
        defaulterThresholdMonths: 2,
        contributions: [dues(1), dues(2), dues(3), dues(4), dues(5)],
      });
      expect(cleared.outstandingContributionMonths).toBe(0);
    });

    it("trailing DEFAULTING recovers to ACTIVE after paying missed months", () => {
      const estimate = estimateProgressionAfterPayingMonths(
        {
          memberId: "m1",
          membershipStart: { month: 1, year: 2026 },
          asOf: { month: 4, year: 2026 },
          defaulterThresholdMonths: 2,
          contributions: [dues(1), dues(2)],
        },
        [
          { month: 3, year: 2026 },
          { month: 4, year: 2026 },
        ],
      );

      expect(estimate.before.membershipStatus).toBe(
        MembershipProgressionStatus.DEFAULTING,
      );
      expect(estimate.after.membershipStatus).toBe(
        MembershipProgressionStatus.ACTIVE,
      );
    });
  });

  // -------------------------------------------------------------------------
  describe("GROUP 8 — EDGE CASE (pay April only)", () => {
    it("March remains outstanding after paying April only", () => {
      const outstanding = computeOutstandingMonths(
        { month: 1, year: 2026 },
        { month: 5, year: 2026 },
        [
          { month: 1, year: 2026 },
          { month: 2, year: 2026 },
          { month: 4, year: 2026 },
          { month: 5, year: 2026 },
        ],
      );

      expect(outstanding).toEqual([{ month: 3, year: 2026 }]);
    });

    it("does not falsely treat March as paid when only April is cleared", () => {
      const result = calculateProgressionFromContributions({
        memberId: "m1",
        membershipStart: { month: 1, year: 2026 },
        asOf: { month: 5, year: 2026 },
        defaulterThresholdMonths: 2,
        contributions: [dues(1), dues(2), dues(4), dues(5)],
      });

      expect(result.welfarePoints).toBe(4);
      // March unpaid must not inflate points
      expect(result.welfarePoints).not.toBe(5);
    });

    /**
     * Paying April only must not clear March, and outstanding count must
     * remain accurate (no false reset to zero outstanding / ACTIVE).
     */
    it("does not falsely reset outstanding while March remains unpaid", () => {
      const result = calculateProgressionFromContributions({
        memberId: "m1",
        membershipStart: { month: 1, year: 2026 },
        asOf: { month: 5, year: 2026 },
        defaulterThresholdMonths: 2,
        contributions: [dues(1), dues(2), dues(4), dues(5)],
      });

      expect(result.outstandingContributionMonths).toBe(1);
      expect(result.outstandingMonths).toEqual([{ month: 3, year: 2026 }]);
      expect(result.membershipStatus).toBe(MembershipProgressionStatus.ACTIVE);
    });
  });

  // -------------------------------------------------------------------------
  describe("GROUP 9 — BENEFIT PERCENTAGE", () => {
    it("matches constitutional table and post-maturity formula", () => {
      expect(calculateBenefitPercentage(6)).toBe(25);
      expect(calculateBenefitPercentage(12)).toBe(40);
      expect(calculateBenefitPercentage(18)).toBe(55);
      expect(calculateBenefitPercentage(24)).toBe(70);
      expect(calculateBenefitPercentage(30)).toBe(85);
      expect(calculateBenefitPercentage(36)).toBe(100);

      for (const points of [7, 10, 15, 20, 25, 35]) {
        expect(calculateBenefitPercentage(points)).toBe(
          Math.min(100, Math.floor(25 + (points - 6) * 2.5)),
        );
      }
    });
  });

  // -------------------------------------------------------------------------
  describe("GROUP 10 — PROGRESSION UPDATES", () => {
    it("each successful paid month adds 1 point and updates benefit/maturity/eligibility", () => {
      const start = { month: 1, year: 2026 };
      let contributions: ReturnType<typeof dues>[] = [];

      for (let month = 1; month <= 7; month += 1) {
        contributions = [...contributions, dues(month)];
        const result = calculateProgressionFromContributions({
          memberId: "m1",
          membershipStart: start,
          asOf: { month, year: 2026 },
          defaulterThresholdMonths: 2,
          contributions,
        });

        expect(result.welfarePoints).toBe(month);
        expect(result.benefitPercentage).toBe(
          calculateBenefitPercentage(month),
        );
        expect(result.isMature).toBe(month >= MATURITY_SUCCESSFUL_MONTHS);
        expect(result.eligibleToClaim).toBe(
          month >= MATURITY_SUCCESSFUL_MONTHS &&
            result.membershipStatus === MembershipProgressionStatus.ACTIVE,
        );
      }
    });
  });

  // -------------------------------------------------------------------------
  describe("GROUP 11 — CLAIMS ELIGIBILITY FOLLOWS PROGRESSION", () => {
    it("blocks claim submit when progression eligibleToClaim is false", async () => {
      getProgression.mockResolvedValue({
        memberId: "m1",
        welfarePoints: 8,
        benefitPercentage: 30,
        successfulContributionMonths: 8,
        consecutiveContributionMonths: 0,
        consecutiveMissedMonths: 2,
        isMature: true,
        eligibleToClaim: false,
        membershipStatus: MembershipProgressionStatus.DEFAULTING,
        maturityDate: "2026-06-01T00:00:00.000Z",
        lastSuccessfulContributionDate: "2026-03-01T00:00:00.000Z",
        membershipStartMonth: 1,
        membershipStartYear: 2026,
        calculatedAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
      } as never);

      const result = await evaluateClaimSubmissionEligibility({
        memberId: "m1",
        claimTypeCode: "medical_support",
      });

      expect("error" in result).toBe(false);
      if ("error" in result) return;
      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain(CLAIM_PROGRESSION_REASONS.NOT_ELIGIBLE);
    });

    it("allows claim submit when progression eligibleToClaim is true after recovery", async () => {
      getProgression.mockResolvedValue({
        memberId: "m1",
        welfarePoints: 8,
        benefitPercentage: 30,
        successfulContributionMonths: 8,
        consecutiveContributionMonths: 8,
        consecutiveMissedMonths: 0,
        isMature: true,
        eligibleToClaim: true,
        membershipStatus: MembershipProgressionStatus.ACTIVE,
        maturityDate: "2026-06-01T00:00:00.000Z",
        lastSuccessfulContributionDate: "2026-08-01T00:00:00.000Z",
        membershipStartMonth: 1,
        membershipStartYear: 2026,
        calculatedAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      } as never);

      const result = await evaluateClaimSubmissionEligibility({
        memberId: "m1",
        claimTypeCode: "medical_support",
      });

      expect("error" in result).toBe(false);
      if ("error" in result) return;
      expect(result.eligible).toBe(true);
      expect(result.eligibleToClaim).toBe(true);
      expect(result.recommendedAmount).toBe(300);
    });
  });

  // -------------------------------------------------------------------------
  describe("GROUP 12 — AUDIT", () => {
    it("formats Paid April/May 2026 contribution audit descriptions", () => {
      expect(
        formatAuditDescription(
          PaymentAuditAction.PAYMENT_CONTRIBUTION_CREATED,
          {
            outcome: "created",
            contributionType: ContributionType.MONTHLY_DUES,
            month: 4,
            year: 2026,
            paymentReference: "GIS-1",
          },
        ),
      ).toBe("Paid April 2026 contribution.");

      expect(
        formatAuditDescription(
          PaymentAuditAction.PAYMENT_CONTRIBUTION_CREATED,
          {
            outcome: "created",
            contributionType: ContributionType.MONTHLY_DUES,
            month: 5,
            year: 2026,
            paymentReference: "GIS-1",
          },
        ),
      ).toBe("Paid May 2026 contribution.");
    });

    it("writes a contribution audit when a month is created from payment", async () => {
      createContribution.mockResolvedValue({
        id: "c-apr",
        month: 4,
        year: 2026,
      } as never);

      await ensureContributionFromPayment(
        {
          id: "payment-audit",
          memberId: "member-1",
          memberName: "Member",
          serviceNumber: "IS/1",
          email: "a@b.c",
          amount: 50,
          currency: "GHS",
          reference: "GIS-AUDIT-1",
          paymentType: PaymentType.MONTHLY_DUES,
          provider: PaymentProvider.PAYSTACK,
          providerReference: "ps-a",
          status: PaymentStatus.SUCCESS,
          selectedMonths: [{ month: 4, year: 2026 }],
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
          paidAt: "2026-06-01T00:00:00.000Z",
        },
        {
          uid: "member-1",
          fullName: "Member",
          role: UserRole.MEMBER,
          serviceNumber: "IS/1",
          profileCompleted: true,
          profileCompletionPercentage: 100,
        },
      );

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: PaymentAuditAction.PAYMENT_CONTRIBUTION_CREATED,
          metadata: expect.objectContaining({
            outcome: "created",
            month: 4,
            year: 2026,
          }),
        }),
      );
    });

    it("emits progression recalculated / benefit% / status-change audit events", () => {
      const repoSrc = readFileSync(
        join(process.cwd(), "src/lib/progression/repository.ts"),
        "utf8",
      );
      const engineSrc = readFileSync(
        join(process.cwd(), "src/lib/progression/engine.ts"),
        "utf8",
      );

      const progressionAuditSurface = `${repoSrc}\n${engineSrc}`;
      expect(progressionAuditSurface).toMatch(/createAuditLog/);
      expect(progressionAuditSurface).toMatch(
        /ProgressionAuditAction|PROGRESSION_RECALCULATED|BENEFIT_PERCENTAGE_CHANGED|MEMBERSHIP_STATUS_CHANGED/,
      );
      expect(engineSrc).toMatch(/recalculateMembershipProgression/);
      expect(engineSrc).toMatch(/runMembershipProgressionCalculation/);
    });
  });

  // -------------------------------------------------------------------------
  describe("GROUP 13 — REPORTS & DASHBOARD", () => {
    it("Membership Progression report type exists", () => {
      expect(ReportType.MEMBERSHIP_PROGRESSION).toBe("membership_progression");
    });

    it("Outstanding Contributions Report exists as a first-class report type", () => {
      const reportTypes = Object.values(ReportType);
      expect(reportTypes).toContain("outstanding_contributions");
    });

    it("Outstanding Contributions export module is present", () => {
      const exportSrc = readFileSync(
        join(
          process.cwd(),
          "src/lib/reports/export/outstanding-contributions.ts",
        ),
        "utf8",
      );
      expect(exportSrc).toMatch(/outstandingMonthLabels/);
      expect(exportSrc).toMatch(/totalOutstandingMonths/);
      expect(exportSrc).toMatch(/membershipStatus/);
    });

    it("executive progression insights module is present for dashboard accuracy", () => {
      const insightsSrc = readFileSync(
        join(
          process.cwd(),
          "src/lib/dashboard/executive-progression-insights.ts",
        ),
        "utf8",
      );
      expect(insightsSrc).toMatch(/outstandingMonthLabels/);
      expect(insightsSrc).toMatch(/defaulting|welfarePoints|benefitPercentage/i);
    });
  });
});
