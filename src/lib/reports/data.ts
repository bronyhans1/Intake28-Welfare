import { listContributions } from "@/lib/contributions/repository";
import { getDefaulters } from "@/lib/finance/defaulters";
import { listWelfareSupport } from "@/lib/welfare/repository";
import type { ContributionListQuery } from "@/lib/validators/contributions";
import type { WelfareSupportListQuery } from "@/lib/validators/welfare-support";
import type { SerializedContribution } from "@/types/contribution";
import type { SerializedWelfareSupport } from "@/types/welfare-support";
import type { DefaulterRecord } from "@/lib/finance/defaulters";

const EXPORT_PAGE_SIZE = 100;

export async function fetchAllContributionsForReport(
  filters: Omit<ContributionListQuery, "page" | "pageSize">,
): Promise<SerializedContribution[]> {
  const records: SerializedContribution[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await listContributions({
      ...filters,
      page,
      pageSize: EXPORT_PAGE_SIZE,
    });
    records.push(...result.records);
    totalPages = result.totalPages;
    page += 1;
  }

  return records;
}

export async function fetchAllWelfareSupportForReport(
  filters: Omit<WelfareSupportListQuery, "page" | "pageSize">,
): Promise<SerializedWelfareSupport[]> {
  const records: SerializedWelfareSupport[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await listWelfareSupport({
      ...filters,
      page,
      pageSize: EXPORT_PAGE_SIZE,
    });
    records.push(...result.records);
    totalPages = result.totalPages;
    page += 1;
  }

  return records;
}

export async function fetchDefaultersForReport(filters: {
  month?: number;
  year?: number;
}): Promise<DefaulterRecord[]> {
  return getDefaulters(filters);
}
