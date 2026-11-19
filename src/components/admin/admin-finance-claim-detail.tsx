"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  completeClaimPaymentAction,
  startClaimPaymentProcessingAction,
} from "@/actions/claim-admin";
import { ActivityTimeline } from "@/components/timeline";
import {
  canCompleteClaimPayment,
  canStartClaimPaymentProcessing,
} from "@/lib/claims/claim-access";
import { claimAuditHistoryToTimelineEvents } from "@/lib/claims/claim-timeline-adapter";
import { formatDisplayDate } from "@/lib/utils/format-date";
import {
  CLAIM_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
} from "@/types/enums";
import type { SerializedClaim } from "@/types/claims";
import type { MemberVisiblePaymentSummary } from "@/types/payment";
import { buttonVariants } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import { cn } from "@/lib/utils";

const FINANCE_METHODS = [
  PaymentMethod.MOBILE_MONEY,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.CASH,
  PaymentMethod.CHEQUE,
  PaymentMethod.OTHER,
] as const;

interface AdminFinanceClaimDetailProps {
  claim: SerializedClaim;
  payment: MemberVisiblePaymentSummary | null;
  canProcessPayments: boolean;
}

export function AdminFinanceClaimDetail({
  claim,
  payment,
  canProcessPayments,
}: AdminFinanceClaimDetailProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const approved = claim.approvedBenefitAmount ?? 0;
  const [amount, setAmount] = useState(String(approved || ""));
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentMethod, setPaymentMethod] = useState<string>(
    PaymentMethod.MOBILE_MONEY,
  );
  const [referenceNumber, setReferenceNumber] = useState("");
  const [financeNotes, setFinanceNotes] = useState("");
  const [reductionReason, setReductionReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const timelineEvents = claimAuditHistoryToTimelineEvents(claim.auditHistory);
  const amountNumber = Number(amount);
  const isReduced =
    Number.isFinite(amountNumber) &&
    amountNumber > 0 &&
    amountNumber < approved;
  const isStartingPayment = pendingAction === "start-payment";
  const isCompletingPayment = pendingAction === "complete-payment";
  const anyActionPending = pendingAction != null;

  function runAction(
    actionKey: string,
    action: () => Promise<{ error?: string }>,
    successMessage: string,
  ) {
    setPendingAction(actionKey);
    startTransition(async () => {
      try {
        setError(null);
        const result = await action();
        if (result.error) {
          setError(result.error);
          showError(result.error);
          return;
        }
        showSuccess(successMessage);
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <Link
          href="/admin/claims/finance"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Back to Finance Queue
        </Link>
        <Link
          href={`/admin/claims/submitted/${claim.id}`}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Executive Review View
        </Link>
      </div>

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>{claim.claimNumber ?? claim.reference}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className="font-medium">{CLAIM_STATUS_LABELS[claim.status]}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Member</p>
            <p className="font-medium">
              {claim.memberName} ({claim.serviceNumber})
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Claim Type</p>
            <p className="font-medium">{claim.claimTypeDisplayName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Approved Benefit</p>
            <p className="font-medium">GHS {approved.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Payment Reference</p>
            <p className="font-medium">{claim.paymentId ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      {payment ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Linked Payment (Payments Ledger)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground">Amount Paid</p>
              <p className="font-medium">GHS {payment.amount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Payment Date</p>
              <p className="font-medium">
                {payment.paidAt ? formatDisplayDate(payment.paidAt) : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Method</p>
              <p className="font-medium">
                {payment.paymentMethod
                  ? PAYMENT_METHOD_LABELS[payment.paymentMethod]
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Reference</p>
              <p className="font-medium">{payment.reference}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canProcessPayments && canStartClaimPaymentProcessing(claim.status) ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Start Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Move this claim into Payment Processing.
            </p>
            <LoadingButton
              type="button"
              loading={isStartingPayment}
              loadingText="Starting..."
              className="bg-[#166534] text-white hover:bg-[#14532d]"
              onClick={() =>
                runAction(
                  "start-payment",
                  () =>
                    startClaimPaymentProcessingAction({ claimId: claim.id }),
                  "Payment processing started.",
                )
              }
            >
              Start Payment
            </LoadingButton>
          </CardContent>
        </Card>
      ) : null}

      {canProcessPayments && canCompleteClaimPayment(claim.status) ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Mark as Paid</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Creates a Claim Payment in the Payments ledger. The claim stores
              only the payment reference.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (GHS)</Label>
                <Input
                  id="amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  disabled={anyActionPending}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentDate">Payment Date</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  disabled={anyActionPending}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <select
                  id="paymentMethod"
                  className="h-9 w-full rounded-lg border border-input px-2.5 text-sm"
                  value={paymentMethod}
                  disabled={anyActionPending}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  {FINANCE_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {PAYMENT_METHOD_LABELS[method]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="referenceNumber">Reference (optional)</Label>
                <Input
                  id="referenceNumber"
                  value={referenceNumber}
                  disabled={anyActionPending}
                  onChange={(event) => setReferenceNumber(event.target.value)}
                />
              </div>
            </div>
            {isReduced ? (
              <div className="space-y-2">
                <Label htmlFor="reductionReason">
                  Reduction explanation (required)
                </Label>
                <textarea
                  id="reductionReason"
                  className="min-h-20 w-full rounded-lg border border-input px-2.5 py-2 text-sm"
                  value={reductionReason}
                  disabled={anyActionPending}
                  onChange={(event) => setReductionReason(event.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="financeNotes">Finance notes (internal)</Label>
              <textarea
                id="financeNotes"
                className="min-h-20 w-full rounded-lg border border-input px-2.5 py-2 text-sm"
                value={financeNotes}
                disabled={anyActionPending}
                onChange={(event) => setFinanceNotes(event.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            <LoadingButton
              type="button"
              loading={isCompletingPayment}
              loadingText="Completing Payment..."
              className="bg-[#166534] text-white hover:bg-[#14532d]"
              onClick={() =>
                runAction(
                  "complete-payment",
                  () =>
                    completeClaimPaymentAction({
                      claimId: claim.id,
                      amount: amountNumber,
                      paymentDate,
                      paymentMethod: paymentMethod as (typeof FINANCE_METHODS)[number],
                      referenceNumber: referenceNumber || null,
                      financeNotes: financeNotes || null,
                      amountReductionReason: reductionReason || null,
                    }),
                  "Claim marked as paid.",
                )
              }
            >
              Mark as Paid
            </LoadingButton>
          </CardContent>
        </Card>
      ) : null}

      {!canProcessPayments ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          You can view payment status. Only Treasurers and Administrators may
          process payments.
        </p>
      ) : null}

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityTimeline events={timelineEvents} />
        </CardContent>
      </Card>
    </div>
  );
}
