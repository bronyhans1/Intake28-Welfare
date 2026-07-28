import {
  CONTRIBUTION_SOURCE_LABELS,
  CONTRIBUTION_STATUS_LABELS,
  CONTRIBUTION_TYPE_LABELS,
  ContributionSource,
  ContributionStatus,
  ContributionType,
} from "@/types/enums";

export function isContributionType(value: string): value is ContributionType {
  return Object.values(ContributionType).includes(value as ContributionType);
}

export function isContributionStatus(value: string): value is ContributionStatus {
  return Object.values(ContributionStatus).includes(value as ContributionStatus);
}

export function formatContributionTypeLabel(
  value: string | ContributionType | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  if (isContributionType(value)) {
    return CONTRIBUTION_TYPE_LABELS[value];
  }

  return CONTRIBUTION_TYPE_LABELS[ContributionType.OTHER];
}

export function formatContributionStatusLabel(
  value: string | ContributionStatus | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  if (isContributionStatus(value)) {
    return CONTRIBUTION_STATUS_LABELS[value];
  }

  return value;
}

export function formatContributionTypeFilterLabel(
  value: string,
  allLabel = "All Types",
): string {
  if (!value || value === "all") {
    return allLabel;
  }

  return formatContributionTypeLabel(value);
}

export function formatContributionStatusFilterLabel(
  value: string,
  allLabel = "All Statuses",
): string {
  if (!value || value === "all") {
    return allLabel;
  }

  return formatContributionStatusLabel(value);
}

export function isContributionSource(
  value: string,
): value is ContributionSource {
  return Object.values(ContributionSource).includes(value as ContributionSource);
}

export function resolveContributionSource(
  value: ContributionSource | string | null | undefined,
): ContributionSource {
  if (value && isContributionSource(value)) {
    return value;
  }

  return ContributionSource.MANUAL;
}

export function formatContributionSourceLabel(
  value: ContributionSource | string | null | undefined,
): string {
  return CONTRIBUTION_SOURCE_LABELS[resolveContributionSource(value)];
}
