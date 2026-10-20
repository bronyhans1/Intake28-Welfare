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
import { PaystackBatchNavigation } from "@/components/admin/paystack-batch-navigation";
import { RecoverUnsettledPaymentButton } from "@/components/admin/recover-unsettled-payment-button";
import {
  reconciliationStatusMessage,
  type ReconciliationSummary,
} from "@/lib/finance/reconciliation-view";
import { PAYMENT_STATUS_LABELS } from "@/types/enums";
import { formatCurrency } from "@/lib/utils/currency";

interface ReconciliationOverviewProps {
  summary: ReconciliationSummary;
  canRecoverUnsettledPayments?: boolean;
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

export function ReconciliationOverview({
  summary,
  canRecoverUnsettledPayments = false,
}: ReconciliationOverviewProps) {
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Reconciliation Status</CardTitle>
          <CardDescription>{reconciliationStatusMessage(summary)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
          <div className="rounded-xl border border-black/[0.06] p-4">
            <p className="text-sm text-muted-foreground">
              Unsettled Paystack Successes
            </p>
            <div className="mt-2">
              <IssueCount count={summary.unsettledPaystackPayments.count} />
            </div>
          </div>
          <div className="rounded-xl border border-black/[0.06] p-4">
            <p className="text-sm text-muted-foreground">
              Potential Surplus / Duplicate Charges
            </p>
            <div className="mt-2">
              <IssueCount count={summary.paystackSurplusDuplicatePayments.count} />
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

      {summary.paystackCandidateWindow.candidateCount > 0 ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Paystack Verification Batch</CardTitle>
            <CardDescription>
              Batch {summary.paystackCandidateWindow.batch} of{" "}
              {summary.paystackCandidateWindow.batchCount}. Eligible payments{" "}
              {summary.paystackCandidateWindow.rangeStart}–
              {summary.paystackCandidateWindow.rangeEnd} of{" "}
              {summary.paystackCandidateWindow.candidateCount}, oldest first.
              {summary.paystackCandidateWindow.uncheckedCount > 0
                ? ` ${summary.paystackCandidateWindow.uncheckedCount} eligible payments were not sent to Paystack in this batch.`
                : " Every current eligible payment is in this batch."}{" "}
              Reloading repeats this batch. Use the next or previous batch to
              inspect the others. New or settled payments can shift which
              references fall in each batch.
              {summary.paystackCandidateWindow.requestedBatchAdjusted
                ? " The requested batch was not valid for the current list, so this batch is shown instead."
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaystackBatchNavigation
              batch={summary.paystackCandidateWindow.batch}
              hasPrevious={summary.paystackCandidateWindow.hasPrevious}
              hasNext={summary.paystackCandidateWindow.hasNext}
            />
          </CardContent>
        </Card>
      ) : null}

      {summary.unsettledPaystackPayments.count > 0 ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Unsettled Paystack Successes</CardTitle>
            <CardDescription>
              Paystack confirmed these charges and the portal contribution
              records are missing or incomplete. An authorized administrator
              should review each transaction and recover it with the existing
              approved settlement process. This page does not settle payments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Portal Status</TableHead>
                  <TableHead>Paystack Status</TableHead>
                  <TableHead>Expected Amount</TableHead>
                  <TableHead>Missing Contribution</TableHead>
                  {canRecoverUnsettledPayments ? <TableHead>Action</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.unsettledPaystackPayments.records.map((finding) => (
                  <TableRow key={finding.reference}>
                    <TableCell>{finding.reference}</TableCell>
                    <TableCell>{PAYMENT_STATUS_LABELS[finding.portalStatus]}</TableCell>
                    <TableCell>{PAYMENT_STATUS_LABELS[finding.paystackStatus]}</TableCell>
                    <TableCell>{formatCurrency(finding.expectedAmount)}</TableCell>
                    <TableCell className="max-w-xl whitespace-normal break-words">
                      {finding.missingContributions}
                    </TableCell>
                    {canRecoverUnsettledPayments ? (
                      <TableCell>
                        <RecoverUnsettledPaymentButton
                          reference={finding.reference}
                          memberLabel={
                            finding.serviceNumber ?? finding.memberName ?? finding.memberId
                          }
                          amount={finding.expectedAmount}
                          currency={finding.currency}
                          paymentType={finding.paymentType}
                          periodLabel={finding.periodLabel}
                          portalStatus={finding.portalStatus}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {summary.paystackSurplusDuplicatePayments.count > 0 ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Potential Surplus Or Duplicate Paystack Charges</CardTitle>
            <CardDescription>
              Paystack confirmed these charges, but the monthly-dues period is
              already recorded as PAID against a different payment reference.
              These are not missing contributions. Do not create another
              contribution, receipt, or welfare point from this page. Financial
              disposition requires separate authorized review. This page does
              not settle or refund payments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Surplus Reference</TableHead>
                  <TableHead>Portal Status</TableHead>
                  <TableHead>Paystack Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Existing Paid Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.paystackSurplusDuplicatePayments.records.map((finding) => (
                  <TableRow key={finding.reference}>
                    <TableCell>{finding.serviceNumber ?? finding.memberId}</TableCell>
                    <TableCell>{finding.reference}</TableCell>
                    <TableCell>{PAYMENT_STATUS_LABELS[finding.portalStatus]}</TableCell>
                    <TableCell>{PAYMENT_STATUS_LABELS[finding.paystackStatus]}</TableCell>
                    <TableCell>{formatCurrency(finding.expectedAmount)}</TableCell>
                    <TableCell>{finding.periodLabel}</TableCell>
                    <TableCell>{finding.existingPaymentReference}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {summary.paystackSettlementMismatches.count > 0 ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Paystack Amount Or Currency Differences</CardTitle>
            <CardDescription>
              Paystack reported success, but the amount, currency, or reference
              does not match settlement rules. These are confirmed differences,
              not unverified payments. Do not run settlement until they are
              reviewed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Portal Status</TableHead>
                  <TableHead>Paystack Status</TableHead>
                  <TableHead>Expected Amount</TableHead>
                  <TableHead>Difference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.paystackSettlementMismatches.records.map((finding) => (
                  <TableRow key={`${finding.reference}-${finding.issue}`}>
                    <TableCell>{finding.reference}</TableCell>
                    <TableCell>{PAYMENT_STATUS_LABELS[finding.portalStatus]}</TableCell>
                    <TableCell>{PAYMENT_STATUS_LABELS[finding.paystackStatus]}</TableCell>
                    <TableCell>{formatCurrency(finding.expectedAmount)}</TableCell>
                    <TableCell>{finding.issue}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {summary.paystackVerificationLimitations.count > 0 ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Paystack Verification Not Completed</CardTitle>
            <CardDescription>
              These records could not be verified. They are not confirmed
              mismatches and are not treated as failed payments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Portal Status</TableHead>
                  <TableHead>Limitation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.paystackVerificationLimitations.records.map((finding, index) => (
                  <TableRow key={`${finding.reference ?? "general"}-${finding.reason}-${index}`}>
                    <TableCell>{finding.reference ?? "—"}</TableCell>
                    <TableCell>
                      {finding.portalStatus
                        ? PAYMENT_STATUS_LABELS[finding.portalStatus]
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-xl whitespace-normal break-words">
                      {finding.message}
                    </TableCell>
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
