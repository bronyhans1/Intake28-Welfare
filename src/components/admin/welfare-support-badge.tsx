import { WELFARE_SUPPORT_TYPE_LABELS, WelfareSupportStatus, WelfareSupportType } from "@/types/enums";
import { cn } from "@/lib/utils";

interface BadgeProps {
  className?: string;
}

export function SupportTypeBadge({
  supportType,
  className,
}: BadgeProps & { supportType: WelfareSupportType }) {
  const label = WELFARE_SUPPORT_TYPE_LABELS[supportType] ?? supportType;
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
