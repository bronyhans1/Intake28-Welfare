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
import { ProviderBatchNavigation } from "@/components/admin/provider-batch-navigation";
import { RecoverUnsettledPaymentButton } from "@/components/admin/recover-unsettled-payment-button";
import { ReconciliationDetailSection } from "@/components/admin/reconciliation-detail-section";
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
  const surplusDuplicateCount =
    summary.paystackSurplusDuplicatePayments.count +
    summary.hubtelSurplusDuplicatePayments.count;

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Reconciliation Status</CardTitle>
          <CardDescription>{reconciliationStatusMessage(summary)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
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
              Unsettled Hubtel Successes
            </p>
            <div className="mt-2">
              <IssueCount count={summary.unsettledHubtelPayments.count} />
            </div>
          </div>
          <div className="rounded-xl border border-black/[0.06] p-4">
            <p className="text-sm text-muted-foreground">
              Potential Surplus / Duplicate Charges
            </p>
            <div className="mt-2">
              <IssueCount count={surplusDuplicateCount} />
            </div>
          </div>
        </CardContent>
      </Card>

      {summary.paymentsMissingContributions.count > 0 ? (
        <Card
          className="rounded-2xl border border-black/[0.08] bg-white shadow-sm"
          data-reconciliation-priority="actionable"
        >
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
        <Card
          className="rounded-2xl border border-black/[0.08] bg-white shadow-sm"
          data-reconciliation-priority="actionable"
        >
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
        <Card
          className="rounded-2xl border border-black/[0.08] bg-white shadow-sm"
          data-reconciliation-priority="actionable"
        >
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

      {summary.unsettledPaystackPayments.count > 0 ? (
        <Card
          className="rounded-2xl border border-black/[0.08] bg-white shadow-sm"
          data-reconciliation-priority="actionable"
        >
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
                          providerLabel="Paystack"
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

      {summary.unsettledHubtelPayments.count > 0 ? (
        <Card
          className="rounded-2xl border border-black/[0.08] bg-white shadow-sm"
          data-reconciliation-priority="actionable"
        >
          <CardHeader>
            <CardTitle>Unsettled Hubtel Successes</CardTitle>
            <CardDescription>
              Hubtel confirmed these charges and the portal contribution
              records are missing or incomplete. An authorized administrator
              should review each transaction and recover it with the existing
              approved settlement process. Checkout totals may include the
              processing fee; recovery credits only the official contribution
              amount. This page does not settle payments until Recover is used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Portal Status</TableHead>
                  <TableHead>Hubtel Status</TableHead>
                  <TableHead>Contribution</TableHead>
                  <TableHead>Checkout Total</TableHead>
                  <TableHead>Missing Contribution</TableHead>
                  {canRecoverUnsettledPayments ? <TableHead>Action</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.unsettledHubtelPayments.records.map((finding) => (
                  <TableRow key={finding.reference}>
                    <TableCell>{finding.reference}</TableCell>
                    <TableCell>{PAYMENT_STATUS_LABELS[finding.portalStatus]}</TableCell>
                    <TableCell>{PAYMENT_STATUS_LABELS[finding.hubtelStatus]}</TableCell>
                    <TableCell>{formatCurrency(finding.expectedAmount)}</TableCell>
                    <TableCell>{formatCurrency(finding.expectedCheckoutAmount)}</TableCell>
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
                          providerLabel="Hubtel"
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

      {summary.paystackSettlementMismatches.count > 0 ? (
        <Card
          className="rounded-2xl border border-black/[0.08] bg-white shadow-sm"
          data-reconciliation-priority="actionable"
        >
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

      {summary.hubtelSettlementMismatches.count > 0 ? (
        <Card
          className="rounded-2xl border border-black/[0.08] bg-white shadow-sm"
          data-reconciliation-priority="actionable"
        >
          <CardHeader>
            <CardTitle>Hubtel Amount Or Currency Differences</CardTitle>
            <CardDescription>
              Hubtel reported success, but the checkout amount, currency, or
              reference does not match settlement rules. These are confirmed
              differences, not unverified payments. Do not run settlement until
              they are reviewed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Portal Status</TableHead>
                  <TableHead>Hubtel Status</TableHead>
                  <TableHead>Contribution</TableHead>
                  <TableHead>Expected Checkout</TableHead>
                  <TableHead>Difference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.hubtelSettlementMismatches.records.map((finding) => (
                  <TableRow key={`${finding.reference}-${finding.issue}`}>
                    <TableCell>{finding.reference}</TableCell>
                    <TableCell>{PAYMENT_STATUS_LABELS[finding.portalStatus]}</TableCell>
                    <TableCell>{PAYMENT_STATUS_LABELS[finding.hubtelStatus]}</TableCell>
                    <TableCell>{formatCurrency(finding.expectedAmount)}</TableCell>
                    <TableCell>{formatCurrency(finding.expectedCheckoutAmount)}</TableCell>
                    <TableCell>{finding.issue}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {summary.paystackSurplusDuplicatePayments.count > 0 ? (
        <Card
          className="rounded-2xl border border-black/[0.08] bg-white shadow-sm"
          data-reconciliation-priority="actionable"
        >
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

      {summary.hubtelSurplusDuplicatePayments.count > 0 ? (
        <Card
          className="rounded-2xl border border-black/[0.08] bg-white shadow-sm"
          data-reconciliation-priority="actionable"
        >
          <CardHeader>
            <CardTitle>Potential Surplus Or Duplicate Hubtel Charges</CardTitle>
            <CardDescription>
              Hubtel confirmed these charges, but the monthly-dues period is
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
                  <TableHead>Hubtel Status</TableHead>
                  <TableHead>Contribution</TableHead>
                  <TableHead>Checkout Total</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Existing Paid Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.hubtelSurplusDuplicatePayments.records.map((finding) => (
                  <TableRow key={finding.reference}>
                    <TableCell>{finding.serviceNumber ?? finding.memberId}</TableCell>
                    <TableCell>{finding.reference}</TableCell>
                    <TableCell>{PAYMENT_STATUS_LABELS[finding.portalStatus]}</TableCell>
                    <TableCell>{PAYMENT_STATUS_LABELS[finding.hubtelStatus]}</TableCell>
                    <TableCell>{formatCurrency(finding.expectedAmount)}</TableCell>
                    <TableCell>{formatCurrency(finding.expectedCheckoutAmount)}</TableCell>
                    <TableCell>{finding.periodLabel}</TableCell>
                    <TableCell>{finding.existingPaymentReference}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {summary.paystackCandidateWindow.candidateCount > 0 ? (
        <ReconciliationDetailSection
          sectionId="paystack-batch"
          title={`Paystack Verification Batch — ${summary.paystackCandidateWindow.candidateCount} eligible`}
          description={`Batch ${summary.paystackCandidateWindow.batch} of ${summary.paystackCandidateWindow.batchCount}. Eligible pending or abandoned Paystack payments ${summary.paystackCandidateWindow.rangeStart}–${summary.paystackCandidateWindow.rangeEnd} of ${summary.paystackCandidateWindow.candidateCount}, oldest first. Expand to navigate batches. Confirmed unsettled successes appear above when verified.`}
          recordCount={summary.paystackCandidateWindow.candidateCount}
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {summary.paystackCandidateWindow.uncheckedCount > 0
                ? `${summary.paystackCandidateWindow.uncheckedCount} eligible payments were not sent to Paystack in this batch.`
                : "Every current eligible payment is in this batch."}{" "}
              Reloading repeats this batch. New or settled payments can shift which
              references fall in each batch.
              {summary.paystackCandidateWindow.requestedBatchAdjusted
                ? " The requested batch was not valid for the current list, so this batch is shown instead."
                : ""}
            </p>
            <PaystackBatchNavigation
              batch={summary.paystackCandidateWindow.batch}
              hasPrevious={summary.paystackCandidateWindow.hasPrevious}
              hasNext={summary.paystackCandidateWindow.hasNext}
              companionHubtelBatch={summary.hubtelCandidateWindow.batch}
            />
          </div>
        </ReconciliationDetailSection>
      ) : null}

      {summary.hubtelCandidateWindow.candidateCount > 0 ? (
        <ReconciliationDetailSection
          sectionId="hubtel-batch"
          title={`Hubtel Verification Batch — ${summary.hubtelCandidateWindow.candidateCount} eligible`}
          description={`Batch ${summary.hubtelCandidateWindow.batch} of ${summary.hubtelCandidateWindow.batchCount}. Eligible pending or abandoned Hubtel payments ${summary.hubtelCandidateWindow.rangeStart}–${summary.hubtelCandidateWindow.rangeEnd} of ${summary.hubtelCandidateWindow.candidateCount}, oldest first. Expand to navigate batches. Abandoned checkout attempts stay reviewable here without dominating the page.`}
          recordCount={summary.hubtelCandidateWindow.candidateCount}
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {summary.hubtelCandidateWindow.uncheckedCount > 0
                ? `${summary.hubtelCandidateWindow.uncheckedCount} eligible Hubtel payments were not sent to Hubtel in this batch.`
                : "Every current eligible Hubtel payment is in this batch."}{" "}
              Reloading repeats this batch. New or settled payments can shift which
              references fall in each batch.
              {summary.hubtelCandidateWindow.requestedBatchAdjusted
                ? " The requested batch was not valid for the current list, so this batch is shown instead."
                : ""}
            </p>
            <ProviderBatchNavigation
              provider="hubtel"
              batch={summary.hubtelCandidateWindow.batch}
              hasPrevious={summary.hubtelCandidateWindow.hasPrevious}
              hasNext={summary.hubtelCandidateWindow.hasNext}
              companionBatch={summary.paystackCandidateWindow.batch}
            />
          </div>
        </ReconciliationDetailSection>
      ) : null}

      {summary.paystackVerificationLimitations.count > 0 ? (
        <ReconciliationDetailSection
          sectionId="paystack-limitations"
          title={`Paystack Verification Not Completed — ${summary.paystackVerificationLimitations.count} records`}
          description="These transactions could not be verified with Paystack. Their final payment outcome is unknown. They are not confirmed mismatches and are not treated as failed payments."
          recordCount={summary.paystackVerificationLimitations.count}
        >
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
        </ReconciliationDetailSection>
      ) : null}

      {summary.hubtelVerificationLimitations.count > 0 ? (
        <ReconciliationDetailSection
          sectionId="hubtel-limitations"
          title={`Hubtel Verification Not Completed — ${summary.hubtelVerificationLimitations.count} records`}
          description="These transactions could not be verified with Hubtel. Their final payment outcome is unknown. No-record responses mean Hubtel has no matching transaction—they are not confirmed mismatches, failed payments, or proof that a member was not charged. Use Check status or ?hubtelRecheck=1 for a fresh lookup."
          recordCount={summary.hubtelVerificationLimitations.count}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Portal Status</TableHead>
                <TableHead>Limitation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.hubtelVerificationLimitations.records.map((finding, index) => (
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
        </ReconciliationDetailSection>
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
