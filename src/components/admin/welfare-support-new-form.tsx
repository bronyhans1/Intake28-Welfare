"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  fetchMemberAwaitingPaymentClaimsAction,
  payClaimFromWelfareRecordsAction,
} from "@/actions/welfare-records-desk";
import { createWelfareSupportAction } from "@/actions/welfare-support";
import { AdminBackLink } from "@/components/admin/admin-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/providers/toast-provider";
import {
  createWelfareSupportSchema,
  type CreateWelfareSupportInput,
} from "@/lib/validators/welfare-support";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";
import {
  CLAIM_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
} from "@/types/enums";
import type { SerializedClaim } from "@/types/claims";
import type { SerializedMember } from "@/types/user";
import type { WelfareSupportTypeOption } from "@/types/welfare-support-type";

const FINANCE_METHODS = [
  PaymentMethod.MOBILE_MONEY,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.CASH,
  PaymentMethod.CHEQUE,
  PaymentMethod.OTHER,
] as const;

interface MemberPickerFormProps {
  members: SerializedMember[];
  supportTypes: WelfareSupportTypeOption[];
  canProcessClaimPayments: boolean;
}

export function MemberPickerForm({
  members,
  supportTypes,
  canProcessClaimPayments,
}: MemberPickerFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingClaimIdRef = useRef<string | null>(searchParams.get("claimId"));
  const { showSuccess, showError } = useToast();
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [awaitingClaims, setAwaitingClaims] = useState<SerializedClaim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsError, setClaimsError] = useState<string | null>(null);
  const [payingClaim, setPayingClaim] = useState<SerializedClaim | null>(null);
  const [isStandalonePending, startStandaloneTransition] = useTransition();
  const [isPayPending, startPayTransition] = useTransition();
  const [standaloneError, setStandaloneError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const defaultSupportType = supportTypes[0]?.code ?? "";
  const approved = payingClaim?.approvedBenefitAmount ?? 0;
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentMethod, setPaymentMethod] = useState<string>(
    PaymentMethod.MOBILE_MONEY,
  );
  const [referenceNumber, setReferenceNumber] = useState("");
  const [financeNotes, setFinanceNotes] = useState("");
  const [reductionReason, setReductionReason] = useState("");

  const form = useForm<CreateWelfareSupportInput>({
    resolver: zodResolver(createWelfareSupportSchema),
    defaultValues: {
      memberId: "",
      memberName: "",
      serviceNumber: "",
      supportType: defaultSupportType,
      amount: undefined,
      description: "",
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (!selectedMemberId || !canProcessClaimPayments) {
      setAwaitingClaims([]);
      setClaimsError(null);
      return;
    }

    let cancelled = false;
    setClaimsLoading(true);
    setClaimsError(null);

    void fetchMemberAwaitingPaymentClaimsAction(selectedMemberId).then(
      (result) => {
        if (cancelled) return;
        setClaimsLoading(false);
        if ("error" in result) {
          setClaimsError(result.error);
          setAwaitingClaims([]);
          return;
        }
        setAwaitingClaims(result.data);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [selectedMemberId, canProcessClaimPayments]);

  useEffect(() => {
    const memberId = searchParams.get("memberId");
    if (memberId) {
      handleMemberChange(memberId);
    }
    // Pre-select member once from Pay Now deep link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const claimId = pendingClaimIdRef.current;
    if (
      !claimId ||
      payingClaim ||
      claimsLoading ||
      awaitingClaims.length === 0
    ) {
      return;
    }

    const claim = awaitingClaims.find((entry) => entry.id === claimId);
    if (claim) {
      openPayClaim(claim);
      pendingClaimIdRef.current = null;
    }
  }, [awaitingClaims, claimsLoading, payingClaim]);

  function handleMemberChange(memberId: string | null) {
    if (!memberId) return;
    setSelectedMemberId(memberId);
    setPayingClaim(null);
    setPayError(null);
    setStandaloneError(null);
    const member = members.find((m) => m.id === memberId);
    if (member) {
      setValue("memberId", member.id, { shouldValidate: false });
      setValue("memberName", member.fullName, { shouldValidate: false });
      setValue("serviceNumber", member.serviceNumber, { shouldValidate: false });
    }
  }

  function openPayClaim(claim: SerializedClaim) {
    setPayingClaim(claim);
    setPayError(null);
    setAmount(String(claim.approvedBenefitAmount ?? ""));
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod(PaymentMethod.MOBILE_MONEY);
    setReferenceNumber("");
    setFinanceNotes("");
    setReductionReason("");
  }

  function submitClaimPayment() {
    if (!payingClaim) return;
    const amountNumber = Number(amount);
    const isReduced =
      Number.isFinite(amountNumber) &&
      amountNumber > 0 &&
      amountNumber < approved;

    startPayTransition(async () => {
      setPayError(null);
      const result = await payClaimFromWelfareRecordsAction({
        claimId: payingClaim.id,
        amount: amountNumber,
        paymentDate,
        paymentMethod: paymentMethod as (typeof FINANCE_METHODS)[number],
        referenceNumber: referenceNumber || null,
        financeNotes: financeNotes || null,
        amountReductionReason: isReduced ? reductionReason || null : null,
      });
      if (result.error) {
        setPayError(result.error);
        showError(result.error);
        return;
      }
      showSuccess("Claim marked as paid.");
      setPayingClaim(null);
      const refreshed = await fetchMemberAwaitingPaymentClaimsAction(
        selectedMemberId,
      );
      if ("data" in refreshed) {
        setAwaitingClaims(refreshed.data);
      }
      router.refresh();
    });
  }

  function onStandaloneSubmit(values: CreateWelfareSupportInput) {
    setStandaloneError(null);
    startStandaloneTransition(async () => {
      const result = await createWelfareSupportAction(values);
      if (result?.error) {
        setStandaloneError(result.error);
        showError(result.error);
      }
    });
  }

  const amountNumber = Number(amount);
  const isReduced =
    Number.isFinite(amountNumber) &&
    amountNumber > 0 &&
    amountNumber < approved;

  return (
    <>
      <AdminBackLink href="/admin/welfare-support" label="Back to Welfare Records" />

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Select Member</CardTitle>
        </CardHeader>
        <CardContent>
          <Field className="max-w-xl">
            <FieldLabel>Member</FieldLabel>
            <Select
              value={selectedMemberId}
              onValueChange={(v: string | null) => handleMemberChange(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Search / select a member">
                  {selectedMember
                    ? `${selectedMember.fullName} — ${selectedMember.serviceNumber}`
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.fullName} — {member.serviceNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {selectedMember ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Service Number:{" "}
              <span className="font-medium text-foreground">
                {selectedMember.serviceNumber}
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {selectedMember && canProcessClaimPayments ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Claims Awaiting Payment</CardTitle>
            <p className="text-sm text-muted-foreground">
              Approved member claims ready for Treasurer payment. Claim type
              comes from the claim — do not select a Welfare Support Type.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {claimsLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading claims…
              </p>
            ) : null}
            {claimsError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                {claimsError}
              </p>
            ) : null}
            {!claimsLoading && !claimsError && awaitingClaims.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-muted-foreground">
                No approved claims are currently awaiting payment for this
                member.
              </p>
            ) : null}
            {awaitingClaims.map((claim) => (
              <div
                key={claim.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">
                      {claim.claimTypeDisplayName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Claim No:{" "}
                      <span className="font-mono text-foreground">
                        {claim.claimNumber ?? claim.reference}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Approved Amount:{" "}
                      <span className="font-medium text-[#166534]">
                        {formatCurrency(claim.approvedBenefitAmount ?? 0)}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Status: {CLAIM_STATUS_LABELS[claim.status]}
                      {claim.approvedAt
                        ? ` · Approved ${formatDisplayDate(claim.approvedAt)}`
                        : null}
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="bg-[#166534] text-white hover:bg-[#14532d]"
                    onClick={() => openPayClaim(claim)}
                    disabled={isPayPending}
                  >
                    Pay Claim
                  </Button>
                </div>
              </div>
            ))}

            {payingClaim ? (
              <div className="rounded-xl border border-[#166534]/25 bg-[#166534]/[0.04] p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold tracking-wide text-[#14532d] uppercase">
                    Pay Approved Claim
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Records payment in the Payments ledger and marks the claim as
                    paid. This is not a standalone Welfare Support entry.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Claim Type</p>
                    <p className="font-medium">
                      {payingClaim.claimTypeDisplayName}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Claim Number</p>
                    <p className="font-medium font-mono">
                      {payingClaim.claimNumber ?? payingClaim.reference}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Member</p>
                    <p className="font-medium">
                      {payingClaim.memberName} ({payingClaim.serviceNumber})
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Approved Benefit</p>
                    <p className="font-medium text-[#166534]">
                      {formatCurrency(approved)}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="claim-pay-amount">Payment Amount (GHS)</Label>
                    <Input
                      id="claim-pay-amount"
                      type="number"
                      min={0}
                      step="0.01"
                      value={amount}
                      disabled={isPayPending}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="claim-pay-date">Payment Date</Label>
                    <Input
                      id="claim-pay-date"
                      type="date"
                      value={paymentDate}
                      disabled={isPayPending}
                      onChange={(event) => setPaymentDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="claim-pay-method">Payment Method</Label>
                    <select
                      id="claim-pay-method"
                      className="h-9 w-full rounded-lg border border-input px-2.5 text-sm"
                      value={paymentMethod}
                      disabled={isPayPending}
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
                    <Label htmlFor="claim-pay-ref">Reference (optional)</Label>
                    <Input
                      id="claim-pay-ref"
                      value={referenceNumber}
                      disabled={isPayPending}
                      onChange={(event) =>
                        setReferenceNumber(event.target.value)
                      }
                    />
                  </div>
                </div>
                {isReduced ? (
                  <div className="space-y-2">
                    <Label htmlFor="claim-pay-reduction">
                      Reduction explanation (required)
                    </Label>
                    <textarea
                      id="claim-pay-reduction"
                      className="min-h-20 w-full rounded-lg border border-input px-2.5 py-2 text-sm"
                      value={reductionReason}
                      disabled={isPayPending}
                      onChange={(event) =>
                        setReductionReason(event.target.value)
                      }
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="claim-pay-notes">Finance notes (optional)</Label>
                  <textarea
                    id="claim-pay-notes"
                    className="min-h-20 w-full rounded-lg border border-input px-2.5 py-2 text-sm"
                    value={financeNotes}
                    disabled={isPayPending}
                    onChange={(event) => setFinanceNotes(event.target.value)}
                  />
                </div>
                {payError ? (
                  <p className="text-sm text-rose-700">{payError}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <LoadingButton
                    type="button"
                    loading={isPayPending}
                    loadingText="Paying claim..."
                    className="bg-[#166534] text-white hover:bg-[#14532d]"
                    onClick={submitClaimPayment}
                  >
                    Confirm Payment
                  </LoadingButton>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPayPending}
                    onClick={() => {
                      setPayingClaim(null);
                      setPayError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {selectedMember && !canProcessClaimPayments ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          You can record standalone welfare support. Claim payment processing
          requires Treasurer or Administrator permission.
        </p>
      ) : null}

      {selectedMember ? (
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              Record Other Welfare Support
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              For assistance that did <strong>not</strong> originate from an
              approved member claim. Uses the Welfare Support Type catalog.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onStandaloneSubmit)} noValidate>
              <FieldGroup className="gap-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field data-invalid={!!errors.supportType}>
                    <FieldLabel>Support Type</FieldLabel>
                    {supportTypes.length === 0 ? (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        No active support types are available. An administrator
                        must activate or create types under Support Types.
                      </p>
                    ) : (
                      <Select
                        value={watch("supportType")}
                        onValueChange={(value: string | null) => {
                          if (value)
                            setValue("supportType", value, {
                              shouldValidate: true,
                            });
                        }}
                        disabled={isStandalonePending}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select support type" />
                        </SelectTrigger>
                        <SelectContent>
                          {supportTypes.map((type) => (
                            <SelectItem key={type.code} value={type.code}>
                              {type.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FieldError errors={[errors.supportType]} />
                  </Field>

                  <Field data-invalid={!!errors.amount}>
                    <FieldLabel htmlFor="standalone-amount">
                      Amount (GHS)
                    </FieldLabel>
                    <Input
                      id="standalone-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="e.g. 500"
                      disabled={isStandalonePending}
                      {...register("amount", { valueAsNumber: true })}
                    />
                    <FieldError errors={[errors.amount]} />
                  </Field>
                </div>

                <Field data-invalid={!!errors.description}>
                  <FieldLabel htmlFor="standalone-description">
                    Description
                  </FieldLabel>
                  <Input
                    id="standalone-description"
                    placeholder="Brief description of the welfare support"
                    disabled={isStandalonePending}
                    {...register("description")}
                  />
                  <FieldError errors={[errors.description]} />
                </Field>

                {standaloneError ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                  >
                    {standaloneError}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  className="h-11 bg-[#166534] hover:bg-[#14532d]"
                  disabled={
                    isStandalonePending ||
                    !selectedMemberId ||
                    supportTypes.length === 0
                  }
                >
                  {isStandalonePending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Record Welfare Support"
                  )}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
