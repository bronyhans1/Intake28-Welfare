"use client";

import { Badge } from "@/components/ui/badge";
import {
  formatContributionSourceLabel,
  formatContributionStatusLabel,
  formatContributionTypeLabel,
} from "@/lib/contributions/labels";
import { cn } from "@/lib/utils";
import type { ContributionSource, ContributionStatus, ContributionType } from "@/types/enums";

export function ContributionTypeBadge({
  contributionType,
}: {
  contributionType: ContributionType | string;
}) {
  return (
    <Badge variant="secondary" className="rounded-full">
      {formatContributionTypeLabel(contributionType)}
    </Badge>
  );
}

export function ContributionStatusBadge({
  status,
}: {
  status: ContributionStatus | string;
}) {
  const className = cn(
    "rounded-full",
    status === "paid" && "bg-[#166534]/10 text-[#166534] hover:bg-[#166534]/15",
    status === "pending" && "bg-amber-500/10 text-amber-700 hover:bg-amber-500/15",
    status === "waived" && "bg-slate-500/10 text-slate-700 hover:bg-slate-500/15",
    status === "cancelled" && "bg-destructive/10 text-destructive hover:bg-destructive/15",
  );

  return (
    <Badge variant="secondary" className={className}>
      {formatContributionStatusLabel(status)}
    </Badge>
  );
}

export function ContributionSourceBadge({
  source,
}: {
  source?: ContributionSource | string | null;
}) {
  const label = formatContributionSourceLabel(source);
  const resolved = source === "paystack" ? "paystack" : "manual";

  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-full",
        resolved === "paystack" &&
          "bg-sky-500/10 text-sky-800 hover:bg-sky-500/15",
        resolved === "manual" &&
          "bg-slate-500/10 text-slate-700 hover:bg-slate-500/15",
      )}
    >
      {label}
    </Badge>
  );
}

