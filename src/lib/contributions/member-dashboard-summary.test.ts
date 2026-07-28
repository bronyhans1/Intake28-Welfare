import { describe, expect, it } from "vitest";
import {
  getMemberContributionDashboardDisplay,
  hasMemberContributions,
  MEMBER_CONTRIBUTIONS_EMPTY_MESSAGE,
  MEMBER_CONTRIBUTIONS_LINK_LABEL,
  MEMBER_CONTRIBUTIONS_PATH,
  MEMBER_CONTRIBUTIONS_TITLE,
} from "@/lib/contributions/member-dashboard-summary";
import type { ContributionStats } from "@/lib/contributions/repository";

const withContributions: ContributionStats = {
  totalContributions: 4,
  totalAmountCollected: 200,
  membersContributed: 1,
};

const withoutContributions: ContributionStats = {
  totalContributions: 0,
  totalAmountCollected: 0,
  membersContributed: 0,
};

describe("member contribution dashboard summary", () => {
  it("detects when a member has contributions", () => {
    expect(hasMemberContributions(withContributions)).toBe(true);
    expect(hasMemberContributions(withoutContributions)).toBe(false);
  });

  it("renders statistics when member has contributions", () => {
    const display = getMemberContributionDashboardDisplay(
      withContributions,
      "2026-06-01T00:00:00.000Z",
    );

    expect(display.title).toBe(MEMBER_CONTRIBUTIONS_TITLE);
    expect(display.hasContributions).toBe(true);
    expect(display.totalContributions).toBe(4);
    expect(display.totalAmountPaid).toContain("GHS");
    expect(display.totalAmountPaid).toContain("200");
    expect(display.lastContributionDate).not.toBe("—");
    expect(display.emptyMessage).toBe(MEMBER_CONTRIBUTIONS_EMPTY_MESSAGE);
  });

  it("renders empty state when member has no contributions", () => {
    const display = getMemberContributionDashboardDisplay(withoutContributions, null);

    expect(display.title).toBe(MEMBER_CONTRIBUTIONS_TITLE);
    expect(display.hasContributions).toBe(false);
    expect(display.totalContributions).toBe(0);
    expect(display.totalAmountPaid).toContain("GHS 0.00");
    expect(display.lastContributionDate).toBe("—");
    expect(display.emptyMessage).toBe("No contributions recorded yet.");
  });

  it("renders View Contributions link to the contributions page", () => {
    const withData = getMemberContributionDashboardDisplay(
      withContributions,
      "2026-06-01T00:00:00.000Z",
    );
    const withoutData = getMemberContributionDashboardDisplay(withoutContributions, null);

    expect(withData.linkHref).toBe("/portal/contributions");
    expect(withData.linkLabel).toBe("View Contributions");
    expect(withoutData.linkHref).toBe(MEMBER_CONTRIBUTIONS_PATH);
    expect(withoutData.linkLabel).toBe(MEMBER_CONTRIBUTIONS_LINK_LABEL);
  });
});
