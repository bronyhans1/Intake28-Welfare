"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, CreditCard, History } from "lucide-react";
import { LoadingButton } from "@/components/ui/loading-button";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ManualMomoPaymentPanel } from "@/components/member/manual-momo-payment-panel";
import { estimateProgressionAfterPayingMonths } from "@/lib/contributions/arrears-progression-estimate";
import { monthYearKey, type MonthYear } from "@/lib/finance/period";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import {
  MembershipProgressionStatus,
  PAYMENT_TYPE_LABELS,
  PaymentType,
} from "@/types/enums";
import type { OutstandingMonthItem } from "@/lib/contributions/outstanding-months";
import type { ProgressionContributionInput } from "@/lib/progression/calculator";

interface ProgressionSnapshot {
  membershipStart: MonthYear;
  asOf: MonthYear;
  contributions: ProgressionContributionInput[];
  defaulterThresholdMonths: number;
  welfarePoints: number;
  benefitPercentage: number;
  membershipStatus: MembershipProgressionStatus;
}

interface MemberOutstandingContributionsPaymentProps {
  memberId: string;
  monthlyDuesAmount: number;
  arrears: OutstandingMonthItem[];
  current: OutstandingMonthItem | null;
  progression: ProgressionSnapshot;
  /** Server-evaluated; must not be inferred from client env alone. */
  paymentsEnabled: boolean;
  /** Shown as the MoMo payment reference while manual mode is active. */
  serviceNumber?: string | null;
}

function periodKey(item: { month: number; year: number }): string {
  return monthYearKey(item);
}

function PaymentDueBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      Payment Due
    </span>
  );
}

export function MemberOutstandingContributionsPayment({
  memberId,
  monthlyDuesAmount,
  arrears,
  current,
  progression,
  paymentsEnabled,
  serviceNumber,
}: MemberOutstandingContributionsPaymentProps) {
  const allOutstanding = useMemo(
    () => [...arrears, ...(current ? [current] : [])],
    [arrears, current],
  );
  const hasArrears = arrears.length > 0;
  const showMultiMonthSection = hasArrears;

  const [selectedKeys, setSelectedKeys] = useState<string[]>(() =>
    allOutstanding.map((item) => periodKey(item)),
  );
  const [multiMonthExpanded, setMultiMonthExpanded] = useState(false);
  const [specialSectionExpanded, setSpecialSectionExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [specialAmount, setSpecialAmount] = useState("");
  const [otherPaymentType, setOtherPaymentType] = useState<string>(
    PaymentType.SPECIAL_CONTRIBUTION,
  );
  const [isOtherSubmitting, setIsOtherSubmitting] = useState(false);

  const selectedMonths = allOutstanding.filter((item) =>
    selectedKeys.includes(periodKey(item)),
  );
  const totalAmount = selectedMonths.length * monthlyDuesAmount;

  const estimate = useMemo(() => {
    if (selectedMonths.length === 0) {
      return {
        before: {
          welfarePoints: progression.welfarePoints,
          benefitPercentage: progression.benefitPercentage,
          membershipStatus: progression.membershipStatus,
        },
        after: {
          welfarePoints: progression.welfarePoints,
          benefitPercentage: progression.benefitPercentage,
          membershipStatus: progression.membershipStatus,
        },
      };
    }

    return estimateProgressionAfterPayingMonths(
      {
        memberId,
        contributions: progression.contributions,
        membershipStart: progression.membershipStart,
        asOf: progression.asOf,
        defaulterThresholdMonths: progression.defaulterThresholdMonths,
      },
      selectedMonths,
    );
  }, [memberId, progression, selectedMonths]);

  function toggleMonth(key: string) {
    setSelectedKeys((currentKeys) =>
      currentKeys.includes(key)
        ? currentKeys.filter((item) => item !== key)
        : [...currentKeys, key],
    );
  }

  function selectAllOutstanding() {
    setSelectedKeys(arrears.map((item) => periodKey(item)));
  }

  function selectAllIncludingCurrent() {
    setSelectedKeys(allOutstanding.map((item) => periodKey(item)));
  }

  async function handlePayMonths(months: OutstandingMonthItem[]) {
    if (months.length === 0) {
      setError("Select at least one contribution month.");
      return;
    }

    const amount = months.length * monthlyDuesAmount;
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          paymentType: PaymentType.MONTHLY_DUES,
          selectedMonths: months.map((item) => ({
            month: item.month,
            year: item.year,
          })),
          amount,
        }),
      });

      const responsePayload = (await response.json()) as {
        error?: string;
        data?: { authorizationUrl: string };
      };

      if (!response.ok || !responsePayload.data?.authorizationUrl) {
        throw new Error(responsePayload.error || "Failed to start payment.");
      }

      window.location.href = responsePayload.data.authorizationUrl;
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to start payment.",
      );
      setIsSubmitting(false);
    }
  }

  async function handlePayCurrentMonth() {
    if (!current) return;
    await handlePayMonths([current]);
  }

  async function handlePaySelected() {
    await handlePayMonths(selectedMonths);
  }

  async function handleOtherPayment() {
    setError(null);
    setIsOtherSubmitting(true);

    try {
      const amount = Number(specialAmount);
      if (!Number.isFinite(amount) || amount < 1) {
        throw new Error("Enter a valid amount.");
      }

      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          paymentType: otherPaymentType,
          amount,
        }),
      });

      const responsePayload = (await response.json()) as {
        error?: string;
        data?: { authorizationUrl: string };
      };

      if (!response.ok || !responsePayload.data?.authorizationUrl) {
        throw new Error(responsePayload.error || "Failed to start payment.");
      }

      window.location.href = responsePayload.data.authorizationUrl;
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to start payment.",
      );
      setIsOtherSubmitting(false);
    }
  }

  const multiMonthToggleLabel = current
    ? "Pay multiple months or arrears"
    : "Pay outstanding months";

  if (!paymentsEnabled) {
    const arrearsTotal = arrears.reduce((sum, item) => sum + item.amount, 0);
    const outstandingTotal =
      arrearsTotal + (current ? current.amount : 0);

    return (
      <div className="mb-6 space-y-4">
        <div className="rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Monthly Welfare Contributions
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your outstanding balance is shown below. Pay via Mobile Money
                using the details provided — do not use online checkout while
                this temporary arrangement is active.
              </p>
            </div>
            <Link
              href="/payments"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <History className="size-4" />
              Payment History
            </Link>
          </div>

          {allOutstanding.length === 0 ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              You have no outstanding monthly dues. All contribution months from
              your join date through the current month are paid.
            </p>
          ) : (
            <div className="mt-5 space-y-5">
              {current ? (
                <section className="rounded-xl border border-[#166534]/20 bg-[#166534]/[0.03] p-4 sm:p-5">
                  <p className="text-xs font-semibold tracking-wide text-[#166534] uppercase">
                    Monthly Welfare Contribution
                  </p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {current.label}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your regular monthly welfare contribution
                  </p>
                  <p className="mt-3 text-xl font-semibold text-[#166534] sm:text-2xl">
                    {formatCurrency(current.amount)}
                  </p>
                  <div className="mt-3">
                    <PaymentDueBadge />
                  </div>
                </section>
              ) : null}

              {hasArrears ? (
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Previous Unpaid Months
                    </h3>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {arrears.length === 1
                        ? "1 outstanding month"
                        : `${arrears.length} outstanding months`}
                      {" · "}
                      {formatCurrency(arrearsTotal)}
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {arrears.map((item) => (
                      <li
                        key={periodKey(item)}
                        className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.08] bg-white px-3 py-3 text-sm"
                      >
                        <span className="font-medium text-foreground">
                          {item.label}
                        </span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(item.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <p className="text-sm font-semibold text-foreground">
                Total outstanding {formatCurrency(outstandingTotal)}
              </p>
            </div>
          )}

          <div className="mt-5">
            <ManualMomoPaymentPanel serviceNumber={serviceNumber} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Monthly Welfare Contributions
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pay your regular monthly welfare contribution. Each month can only
              be paid once.
            </p>
          </div>
          <Link
            href="/payments"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <History className="size-4" />
            Payment History
          </Link>
        </div>

        {allOutstanding.length === 0 ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            You have no outstanding monthly dues. All contribution months from
            your join date through the current month are paid.
          </p>
        ) : (
          <div className="mt-5 space-y-5">
            {current ? (
              <section className="rounded-xl border border-[#166534]/20 bg-[#166534]/[0.03] p-4 sm:p-5">
                <p className="text-xs font-semibold tracking-wide text-[#166534] uppercase">
                  Monthly Welfare Contribution
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {current.label}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your regular monthly welfare contribution
                </p>
                <p className="mt-3 text-xl font-semibold text-[#166534] sm:text-2xl">
                  {formatCurrency(current.amount)}
                </p>
                <div className="mt-3">
                  <PaymentDueBadge />
                </div>
                <div className="mt-4">
                  <LoadingButton
                    type="button"
                    onClick={handlePayCurrentMonth}
                    loading={isSubmitting}
                    loadingText="Processing…"
                    className="w-full bg-[#166534] text-white hover:bg-[#14532d] sm:w-auto"
                  >
                    <CreditCard className="size-4" />
                    Pay {current.label} Contribution
                  </LoadingButton>
                </div>
              </section>
            ) : null}

            {showMultiMonthSection ? (
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Previous Unpaid Months
                  </h3>
                  {hasArrears ? (
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {arrears.length === 1
                        ? "1 outstanding month"
                        : `${arrears.length} outstanding months`}
                      {" · "}
                      {formatCurrency(
                        arrears.reduce((sum, item) => sum + item.amount, 0),
                      )}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {current
                      ? "You also have previous unpaid months."
                      : "You have previous unpaid monthly contributions."}
                  </p>
                </div>

                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full justify-between sm:w-auto",
                  )}
                  aria-expanded={multiMonthExpanded}
                  onClick={() => setMultiMonthExpanded((open) => !open)}
                >
                  {multiMonthToggleLabel}
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      multiMonthExpanded ? "rotate-180" : "",
                    )}
                  />
                </button>

                {multiMonthExpanded ? (
                  <div className="space-y-5 border-t border-black/[0.06] pt-5">
                    {hasArrears ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-foreground">
                            Select months to pay
                          </h4>
                          <button
                            type="button"
                            className="text-sm font-medium text-[#166534] hover:underline"
                            onClick={selectAllOutstanding}
                          >
                            Select All Outstanding
                          </button>
                        </div>
                        <ul className="space-y-2">
                          {arrears.map((item) => {
                            const key = periodKey(item);
                            const checked = selectedKeys.includes(key);
                            return (
                              <li key={key}>
                                <label
                                  className={cn(
                                    "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-3 text-sm",
                                    checked
                                      ? "border-[#166534]/30 bg-[#166534]/[0.04]"
                                      : "border-black/[0.08] bg-white",
                                  )}
                                >
                                  <span className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      className="size-4 accent-[#166534]"
                                      checked={checked}
                                      onChange={() => toggleMonth(key)}
                                    />
                                    <span className="font-medium text-foreground">
                                      {item.label}
                                    </span>
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {formatCurrency(item.amount)}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}

                    {current ? (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-foreground">
                          Current month
                        </h4>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-3 text-sm",
                            selectedKeys.includes(periodKey(current))
                              ? "border-[#166534]/30 bg-[#166534]/[0.04]"
                              : "border-black/[0.08] bg-white",
                          )}
                        >
                          <span className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              className="size-4 accent-[#166534]"
                              checked={selectedKeys.includes(periodKey(current))}
                              onChange={() => toggleMonth(periodKey(current))}
                            />
                            <span className="font-medium text-foreground">
                              {current.label}
                            </span>
                          </span>
                          <span className="font-medium text-foreground">
                            {formatCurrency(current.amount)}
                          </span>
                        </label>
                      </div>
                    ) : null}

                    <div className="rounded-xl border border-black/[0.08] bg-muted/20 px-4 py-4">
                      <p className="text-sm font-medium text-foreground">
                        You are about to pay
                      </p>
                      {selectedMonths.length === 0 ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No months selected.
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {selectedMonths.map((item) => (
                            <li key={periodKey(item)}>• {item.label}</li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-3 text-base font-semibold text-foreground">
                        Total {formatCurrency(totalAmount)}
                      </p>

                      <div className="mt-4 border-t border-black/[0.06] pt-3 text-sm">
                        <p className="font-medium text-foreground">
                          Estimated Progression Update
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          Benefit Percentage{" "}
                          <span className="font-medium text-foreground">
                            {estimate.before.benefitPercentage}%
                          </span>{" "}
                          →{" "}
                          <span className="font-medium text-foreground">
                            {estimate.after.benefitPercentage}%
                          </span>
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          Welfare Points{" "}
                          <span className="font-medium text-foreground">
                            {estimate.before.welfarePoints}
                          </span>{" "}
                          →{" "}
                          <span className="font-medium text-foreground">
                            {estimate.after.welfarePoints}
                          </span>
                        </p>
                        {estimate.before.membershipStatus !==
                        estimate.after.membershipStatus ? (
                          <p className="mt-1 text-muted-foreground">
                            Membership Status{" "}
                            <span className="font-medium text-foreground">
                              {estimate.before.membershipStatus}
                            </span>{" "}
                            →{" "}
                            <span className="font-medium text-foreground">
                              {estimate.after.membershipStatus}
                            </span>
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs text-muted-foreground">
                          Estimate only. Final progression updates after
                          successful payment verification.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={cn(buttonVariants({ variant: "outline" }))}
                        onClick={selectAllIncludingCurrent}
                      >
                        Select All
                      </button>
                      <LoadingButton
                        type="button"
                        onClick={handlePaySelected}
                        loading={isSubmitting}
                        loadingText="Processing…"
                        disabled={selectedMonths.length === 0}
                        className="bg-[#166534] text-white hover:bg-[#14532d]"
                      >
                        <CreditCard className="size-4" />
                        Pay Selected Months
                      </LoadingButton>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-semibold text-foreground">
          Special Contribution
        </h3>
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Only use this option when instructed by the Welfare Team. Do not use
          this to pay your regular monthly contribution.
        </p>

        {!specialSectionExpanded ? (
          <div className="mt-4">
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
              onClick={() => setSpecialSectionExpanded(true)}
            >
              Make a Special Contribution
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="other-amount">Special contribution amount (GHS)</Label>
                <Input
                  id="other-amount"
                  type="number"
                  min={1}
                  step="0.01"
                  value={specialAmount}
                  onChange={(event) => setSpecialAmount(event.target.value)}
                  placeholder="Enter amount"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Type</Label>
                <Select
                  value={otherPaymentType}
                  onValueChange={(value) =>
                    setOtherPaymentType(value ?? PaymentType.SPECIAL_CONTRIBUTION)
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {PAYMENT_TYPE_LABELS[otherPaymentType as PaymentType]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PaymentType.SPECIAL_CONTRIBUTION}>
                      {PAYMENT_TYPE_LABELS[PaymentType.SPECIAL_CONTRIBUTION]}
                    </SelectItem>
                    <SelectItem value={PaymentType.OTHER}>
                      {PAYMENT_TYPE_LABELS[PaymentType.OTHER]}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <LoadingButton
                type="button"
                variant="outline"
                onClick={handleOtherPayment}
                loading={isOtherSubmitting}
                loadingText="Processing…"
              >
                Pay Special Contribution
              </LoadingButton>
              <button
                type="button"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                onClick={() => setSpecialSectionExpanded(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export type { ProgressionSnapshot };
