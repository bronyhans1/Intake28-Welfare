import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";
import type { ContributionStats } from "@/lib/contributions/repository";

export const MEMBER_CONTRIBUTIONS_PATH = "/portal/contributions";

export const MEMBER_CONTRIBUTIONS_EMPTY_MESSAGE = "No contributions recorded yet.";

export const MEMBER_CONTRIBUTIONS_LINK_LABEL = "View Contributions";

export const MEMBER_CONTRIBUTIONS_TITLE = "My Contributions";

export function hasMemberContributions(stats: Pick<ContributionStats, "totalContributions">) {
  return stats.totalContributions > 0;
}

export function getMemberContributionDashboardDisplay(
  stats: ContributionStats,
  lastContributionDate: string | null,
) {
  const memberHasContributions = hasMemberContributions(stats);

  return {
    title: MEMBER_CONTRIBUTIONS_TITLE,
    hasContributions: memberHasContributions,
    emptyMessage: MEMBER_CONTRIBUTIONS_EMPTY_MESSAGE,
    totalContributions: stats.totalContributions,
    totalAmountPaid: formatCurrency(stats.totalAmountCollected),
    lastContributionDate: lastContributionDate
      ? formatDisplayDate(lastContributionDate)
      : "—",
    linkHref: MEMBER_CONTRIBUTIONS_PATH,
    linkLabel: MEMBER_CONTRIBUTIONS_LINK_LABEL,
  };
}
