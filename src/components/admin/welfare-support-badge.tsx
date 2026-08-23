import { WelfareSupportStatus } from "@/types/enums";
import { resolveWelfareSupportTypeDisplayName } from "@/lib/welfare-support-types/labels";
import { cn } from "@/lib/utils";
import type { WelfareHistorySource } from "@/types/welfare-history";
interface BadgeProps {
  className?: string;
}

export function SupportTypeBadge({
  supportType,
  labelMap,
  className,
}: BadgeProps & {
  supportType: string;
  /** Optional catalog label map (code → displayName). Inactive types included. */
  labelMap?: ReadonlyMap<string, string> | Record<string, string> | null;
}) {
  const label = resolveWelfareSupportTypeDisplayName(supportType, labelMap);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-current/20 bg-current/10 px-2 py-0.5 text-xs font-medium",
        "text-blue-700",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function SupportStatusBadge({
  status,
  className,
}: BadgeProps & { status: WelfareSupportStatus }) {
  const styles: Record<WelfareSupportStatus, string> = {
    approved: "text-green-700",
    pending: "text-yellow-700",
    paid: "text-[#166534]",
    cancelled: "text-red-700",
  };

  const labels: Record<WelfareSupportStatus, string> = {
    approved: "Approved",
    pending: "Pending",
    paid: "Paid",
    cancelled: "Cancelled",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-current/20 bg-current/10 px-2 py-0.5 text-xs font-medium",
        styles[status],
        className,
      )}
    >
      {labels[status]}
    </span>
  );
}

export function WelfareHistorySourceBadge({
  source,
  className,
}: BadgeProps & { source: WelfareHistorySource }) {
  const styles: Record<WelfareHistorySource, string> = {
    claim_payment: "text-violet-700",
    welfare_support: "text-teal-700",
  };

  const labels: Record<WelfareHistorySource, string> = {
    claim_payment: "Claim Payment",
    welfare_support: "Welfare Support",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-current/20 bg-current/10 px-2 py-0.5 text-xs font-medium",
        styles[source],
        className,
      )}
    >
      {labels[source]}
    </span>
  );
}

export function ClaimBenefitTypeBadge({
  label,
  className,
}: BadgeProps & { label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-current/20 bg-current/10 px-2 py-0.5 text-xs font-medium",
        "text-violet-700",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function WelfareHistoryStatusBadge({
  statusLabel,
  className,
}: BadgeProps & { statusLabel: string }) {
  const normalized = statusLabel.toLowerCase();
  const color =
    normalized === "paid"
      ? "text-[#166534]"
      : normalized === "approved"
        ? "text-green-700"
        : normalized === "pending"
          ? "text-yellow-700"
          : normalized === "cancelled"
            ? "text-red-700"
            : "text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-current/20 bg-current/10 px-2 py-0.5 text-xs font-medium",
        color,
        className,
      )}
    >
      {statusLabel}
    </span>
  );
}
