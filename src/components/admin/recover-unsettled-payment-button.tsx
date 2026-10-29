"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recoverUnsettledPaymentAction } from "@/actions/reconciliation";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/types/enums";

interface RecoverUnsettledPaymentButtonProps {
  reference: string;
  memberLabel: string;
  amount: number;
  currency: string;
  paymentType: string;
  periodLabel: string;
  portalStatus: PaymentStatus;
}

export function RecoverUnsettledPaymentButton({
  reference,
  memberLabel,
  amount,
  currency,
  paymentType,
  periodLabel,
  portalStatus,
}: RecoverUnsettledPaymentButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultTone, setResultTone] = useState<"success" | "error" | "info">("info");
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (isPending) return;
    setResultMessage(null);
    startTransition(async () => {
      const result = await recoverUnsettledPaymentAction(reference);
      if (result.outcome === "recovered") {
        setResultTone("success");
      } else if (result.outcome === "already_settled") {
        setResultTone("info");
      } else {
        setResultTone("error");
      }
      setResultMessage(result.message);
      if (result.outcome === "recovered" || result.outcome === "already_settled") {
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-[#166534]/40 text-[#166534] hover:bg-[#166534]/5"
        disabled={isPending}
        onClick={() => {
          setResultMessage(null);
          setOpen(true);
        }}
      >
        Recover
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (isPending) return;
          setOpen(next);
          if (!next) setResultMessage(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recover unsettled payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This recovers a historical Paystack charge by verifying it again on the server and, if
              eligible, record the payment, contribution, and receipt through the
              existing settlement process. It does not refund or reverse funds.
            </AlertDialogDescription>
            <div className="space-y-3 text-sm text-left">
              <dl className="grid gap-1 rounded-lg border border-black/[0.08] bg-black/[0.02] p-3 text-foreground">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Member</dt>
                  <dd className="text-right font-medium">{memberLabel}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Reference</dt>
                  <dd className="text-right font-medium">{reference}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="text-right font-medium">
                    {formatCurrency(amount)} {currency}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Purpose</dt>
                  <dd className="text-right font-medium">{paymentType}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Period</dt>
                  <dd className="text-right font-medium">{periodLabel}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Portal status</dt>
                  <dd className="text-right font-medium">
                    {PAYMENT_STATUS_LABELS[portalStatus]}
                  </dd>
                </div>
              </dl>
              {resultMessage ? (
                <p
                  className={
                    resultTone === "success"
                      ? "text-[#166534]"
                      : resultTone === "error"
                        ? "text-amber-800"
                        : "text-foreground"
                  }
                  role="status"
                >
                  {resultMessage}
                </p>
              ) : null}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {resultMessage ? "Close" : "Cancel"}
            </AlertDialogCancel>
            {!resultMessage ? (
              <Button
                type="button"
                disabled={isPending}
                className="bg-[#166534] hover:bg-[#14532d]"
                onClick={handleConfirm}
              >
                {isPending ? "Recovering…" : "Confirm recovery"}
              </Button>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
