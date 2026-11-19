import Link from "next/link";
import { CreditCard, HeartHandshake, Receipt, Wallet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MEMBER_CONTRIBUTIONS_PATH } from "@/lib/contributions/member-dashboard-summary";
import type { MemberMembershipStatus } from "@/lib/membership/status-summary";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";

interface MemberMembershipStatusCardProps {
  status: MemberMembershipStatus;
}

function StatusItem({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className={`mt-1 text-sm font-medium text-foreground ${valueClassName ?? ""}`}>
        {value}
      </p>
    </div>
  );
}

export function MemberMembershipStatusCard({ status }: MemberMembershipStatusCardProps) {
  const monthName = new Intl.DateTimeFormat("en-GH", { month: "long" }).format(
    new Date(status.monthlyDuesYear, status.monthlyDuesMonth - 1, 1),
  );

  const monthlyDuesStatus = status.monthlyDuesPaid
    ? `Paid for ${monthName} ${status.monthlyDuesYear}`
    : `Not paid for ${monthName} ${status.monthlyDuesYear}`;

  const lastContribution =
    status.lastContributionDate && status.lastContributionAmount != null
      ? `${formatCurrency(status.lastContributionAmount)}${
          status.lastContributionTypeLabel
            ? ` · ${status.lastContributionTypeLabel}`
            : ""
        } on ${formatDisplayDate(status.lastContributionDate)}`
      : "No contributions recorded yet.";

  return (
    <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm lg:col-span-2">
      <CardHeader>
        <CardTitle>My Membership Status</CardTitle>
        <CardDescription>
          Current dues, contributions, payments, and welfare support at a glance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatusItem
            label="Current Month Dues"
            value={monthlyDuesStatus}
            valueClassName={status.monthlyDuesPaid ? "text-emerald-700" : "text-amber-700"}
          />
          <StatusItem label="Last Contribution" value={lastContribution} />
          <StatusItem
            label="Payments"
            value={
              status.paymentCount > 0
                ? `${status.paymentCount} payment${status.paymentCount === 1 ? "" : "s"}${
                    status.lastPaymentDate
                      ? ` · Last ${formatDisplayDate(status.lastPaymentDate)}`
                      : ""
                  }`
                : "No payments recorded yet."
            }
          />
          <StatusItem
            label="Receipts"
            value={
              status.receiptCount > 0
                ? `${status.receiptCount} receipt${status.receiptCount === 1 ? "" : "s"}`
                : "No receipts available yet."
            }
          />
          <StatusItem
            label="Welfare Support"
            value={
              status.welfareSupportCount > 0
                ? `${status.welfareSupportCount} support record${
                    status.welfareSupportCount === 1 ? "" : "s"
                  }`
                : "No welfare support recorded yet."
            }
          />
        </dl>

        {status.monthlyDuesPaid && status.monthlyDuesMessage ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {status.monthlyDuesMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link
            href={MEMBER_CONTRIBUTIONS_PATH}
            className={buttonVariants({
              className: "bg-[#166534] text-white hover:bg-[#14532d]",
            })}
          >
            <Wallet className="size-4" />
            My Contributions
          </Link>
          <Link href="/payments" className={buttonVariants({ variant: "outline" })}>
            <CreditCard className="size-4" />
            Payment History
          </Link>
          <Link href="/portal/welfare-support" className={buttonVariants({ variant: "outline" })}>
            <HeartHandshake className="size-4" />
            Welfare Support
          </Link>
          <Link href="/receipts" className={buttonVariants({ variant: "outline" })}>
            <Receipt className="size-4" />
            Receipts
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
