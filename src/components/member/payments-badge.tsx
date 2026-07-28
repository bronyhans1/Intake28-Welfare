import {
  formatPaymentStatusLabel,
  formatPaymentTypeLabel,
} from "@/lib/payments/labels";
import { PaymentStatus } from "@/types/enums";
import { cn } from "@/lib/utils";

interface BadgeProps {
  className?: string;
}

export function PaymentTypeBadge({
  paymentType,
  className,
}: BadgeProps & { paymentType: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-current/20 bg-current/10 px-2 py-0.5 text-xs font-medium text-sky-700",
        className,
      )}
    >
      {formatPaymentTypeLabel(paymentType)}
    </span>
  );
}

export function PaymentStatusBadge({
  status,
  className,
}: BadgeProps & { status: string }) {
  const styles: Record<string, string> = {
    [PaymentStatus.PENDING]: "text-amber-700",
    [PaymentStatus.SUCCESS]: "text-[#166534]",
    [PaymentStatus.FAILED]: "text-rose-700",
    [PaymentStatus.ABANDONED]: "text-slate-700",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-current/20 bg-current/10 px-2 py-0.5 text-xs font-medium",
        styles[status] ?? "text-muted-foreground",
        className,
      )}
    >
      {formatPaymentStatusLabel(status)}
    </span>
  );
}
