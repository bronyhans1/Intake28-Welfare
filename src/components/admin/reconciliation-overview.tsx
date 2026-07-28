"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReconciliationSummary } from "@/lib/finance/reconciliation";
import { formatCurrency } from "@/lib/utils/currency";

interface ReconciliationOverviewProps {
  summary: ReconciliationSummary;
}

function IssueCount({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-[#166534]">
        <CheckCircle2 className="size-4" />
        0
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-700">
      <AlertTriangle className="size-4" />
      {count}
    </span>
  );
}

export function ReconciliationOverview({ summary }: ReconciliationOverviewProps) {
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Reconciliation Status</CardTitle>
          <CardDescription>
            {summary.isBalanced
              ? "All successful payments, contributions, and receipts are aligned."
              : "One or more financial records need review."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-black/[0.06] p-4">
            <p className="text-sm text-muted-foreground">Payments Missing Contributions</p>
            <div className="mt-2">
              <IssueCount count={summary.paymentsMissingContributions.count} />
            </div>
          </div>
          <div className="rounded-xl border border-black/[0.06] p-4">
            <p className="text-sm text-muted-foreground">Contributions Missing Receipts</p>
            <div className="mt-2">
              <IssueCount count={summary.contributionsMissingReceipts.count} />
            </div>
          </div>
          <div className="rounded-xl border border-black/[0.06] p-4">
            <p className="text-sm text-muted-foreground">Receipts Missing Payments</p>
            <div className="mt-2">
              <IssueCount count={summary.receiptsMissingPayments.count} />
            </div>
          </div>
        </CardContent>
      </Card>

      {summary.paymentsMissingContributions.count > 0 ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Payments Missing Contributions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.paymentsMissingContributions.records.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.reference}</TableCell>
                    <TableCell>{payment.memberName}</TableCell>
                    <TableCell>{formatCurrency(payment.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {summary.contributionsMissingReceipts.count > 0 ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Contributions Missing Receipts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Payment Reference</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.contributionsMissingReceipts.records.map((contribution) => (
                  <TableRow key={contribution.id}>
                    <TableCell>{contribution.memberName}</TableCell>
                    <TableCell>{contribution.paymentReference}</TableCell>
                    <TableCell>{formatCurrency(contribution.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {summary.receiptsMissingPayments.count > 0 ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Receipts Missing Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt Number</TableHead>
                  <TableHead>Payment Reference</TableHead>
                  <TableHead>Member</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.receiptsMissingPayments.records.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell>{receipt.receiptNumber}</TableCell>
                    <TableCell>{receipt.paymentReference}</TableCell>
                    <TableCell>{receipt.memberName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Review related records in{" "}
        <Link href="/admin/contributions" className="text-[#166534] hover:underline">
          Contributions
        </Link>{" "}
        or member receipts as needed.
      </p>
    </div>
  );
}
