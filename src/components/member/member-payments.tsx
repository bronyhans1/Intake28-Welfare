"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CreditCard, History, Lock, Search } from "lucide-react";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { LoadingButton } from "@/components/ui/loading-button";
import { useToast } from "@/components/providers/toast-provider";
import {
  PaymentStatusBadge,
  PaymentTypeBadge,
} from "@/components/member/payments-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatPaymentStatusFilterLabel,
  formatPaymentTypeFilterLabel,
} from "@/lib/payments/labels";
import {
  formatPaymentAmountInput,
  isMonthlyDuesPaymentType,
  resolveMemberPaymentFormAmount,
} from "@/lib/payments/resolve-amount";
import type { PaymentListResult } from "@/lib/payments/repository";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS, PaymentStatus, PaymentType } from "@/types/enums";

interface MemberPaymentsTableProps {
  data: PaymentListResult;
}

const FILTER_ALL = "all";
const SEARCH_DEBOUNCE_MS = 400;

function buildQuery(
  searchParams: URLSearchParams,
  updates: Record<string, string | undefined>,
) {
  const params = new URLSearchParams(searchParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (!value) params.delete(key);
    else params.set(key, value);
  }

  if ("search" in updates || "status" in updates || "paymentType" in updates) {
    params.delete("reference");
    params.set("page", "1");
  }

  return params.toString();
}

export function PaymentVerificationBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reference = searchParams.get("reference");
  const verified = searchParams.get("verified");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const verifiedReference = useRef<string | null>(null);
  const verificationInFlight = useRef<string | null>(null);
  const { showSuccess } = useToast();

  useEffect(() => {
    if (verified === "1" && !reference) {
      setMessage("Payment verified successfully.");
    }
  }, [verified, reference]);

  useEffect(() => {
    if (!reference) return;
    if (
      verifiedReference.current === reference ||
      verificationInFlight.current === reference
    ) {
      return;
    }

    verificationInFlight.current = reference;

    async function verify() {
      setIsVerifying(true);
      setError(null);
      setMessage(null);

      try {
        const response = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ reference }),
        });
        const payload = (await response.json()) as {
          error?: string;
          data?: { status: string };
        };

        if (response.status === 401) {
          verifiedReference.current = reference;
          verificationInFlight.current = null;
          setError(
            "Your session expired during payment verification. Sign in again to view your payment status.",
          );
          router.replace(`/login?next=${encodeURIComponent("/payments")}`);
          return;
        }

        if (!response.ok) {
          throw new Error(payload.error || "Payment verification failed.");
        }

        verifiedReference.current = reference;
        if (payload.data?.status === PaymentStatus.SUCCESS) {
          setMessage("Payment verified successfully.");
          showSuccess("Payment verified successfully");
        } else {
          setMessage(`Payment status: ${payload.data?.status ?? "updated"}.`);
        }

        router.replace("/payments?verified=1");
      } catch (verificationError) {
        verificationInFlight.current = null;
        setError(
          verificationError instanceof Error
            ? verificationError.message
            : "Payment verification failed.",
        );
      } finally {
        setIsVerifying(false);
      }
    }

    void verify();
  }, [reference, router, showSuccess]);

  return (
    <>
      <LoadingOverlay
        open={isVerifying}
        title="Processing Payment..."
        message="Please wait while we verify your transaction."
      />

      {!isVerifying && (reference || verified || message || error) ? (
        <div className="mb-4">
          {message ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function MemberPaymentsTable({ data }: MemberPaymentsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlSearch = searchParams.get("search") ?? "";
  const urlStatus = searchParams.get("status") ?? FILTER_ALL;
  const urlPaymentType = searchParams.get("paymentType") ?? FILTER_ALL;

  const [search, setSearch] = useState(urlSearch);
  const [status, setStatus] = useState(urlStatus);
  const [paymentType, setPaymentType] = useState(urlPaymentType);

  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  useEffect(() => { setSearch(urlSearch); }, [urlSearch]);
  useEffect(() => { setStatus(urlStatus); }, [urlStatus]);
  useEffect(() => { setPaymentType(urlPaymentType); }, [urlPaymentType]);

  function updateFilters(updates: Record<string, string | undefined>) {
    startTransition(() => {
      router.push(`/payments?${buildQuery(searchParams, updates)}`);
    });
  }

  useEffect(() => {
    if (search === urlSearch) return;
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.push(
          `/payments?${buildQuery(searchParamsRef.current, {
            search: search || undefined,
          })}`,
        );
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search, urlSearch, router]);

  function goToPage(page: number) {
    startTransition(() => {
      router.push(`/payments?${buildQuery(searchParams, { page: String(page) })}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2 md:col-span-1">
          <Label htmlFor="payment-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="payment-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reference or member"
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(value) => {
              const next = value ?? FILTER_ALL;
              setStatus(next);
              updateFilters({ status: next === FILTER_ALL ? undefined : next });
            }}
          >
            <SelectTrigger>
              <SelectValue>{formatPaymentStatusFilterLabel(status)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>
                {formatPaymentStatusFilterLabel(FILTER_ALL)}
              </SelectItem>
              {Object.values(PaymentStatus).map((value) => (
                <SelectItem key={value} value={value}>
                  {PAYMENT_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Payment Type</Label>
          <Select
            value={paymentType}
            onValueChange={(value) => {
              const next = value ?? FILTER_ALL;
              setPaymentType(next);
              updateFilters({ paymentType: next === FILTER_ALL ? undefined : next });
            }}
          >
            <SelectTrigger>
              <SelectValue>{formatPaymentTypeFilterLabel(paymentType)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>
                {formatPaymentTypeFilterLabel(FILTER_ALL)}
              </SelectItem>
              {Object.values(PaymentType).map((value) => (
                <SelectItem key={value} value={value}>
                  {PAYMENT_TYPE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payment Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No payments found.
                </TableCell>
              </TableRow>
            ) : (
              data.records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-mono text-xs">{record.reference}</TableCell>
                  <TableCell className="font-medium text-[#166534]">
                    {formatCurrency(record.amount)}
                  </TableCell>
                  <TableCell>
                    <PaymentTypeBadge paymentType={record.paymentType} />
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={record.status} />
                  </TableCell>
                  <TableCell>
                    {formatDisplayDate(record.paidAt ?? record.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages} ({data.total} payments)
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.page <= 1 || isPending}
              onClick={() => goToPage(data.page - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages || isPending}
              onClick={() => goToPage(data.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface MemberContributionPaymentActionsProps {
  memberId: string;
  monthlyDuesAmount: number;
  monthlyDuesAlreadyPaid: boolean;
  monthlyDuesPaidMessage: string | null;
}

export function MemberContributionPaymentActions({
  memberId,
  monthlyDuesAmount,
  monthlyDuesAlreadyPaid,
  monthlyDuesPaidMessage,
}: MemberContributionPaymentActionsProps) {
  const [editableAmount, setEditableAmount] = useState(
    formatPaymentAmountInput(monthlyDuesAmount),
  );
  const [paymentType, setPaymentType] = useState<string>(
    monthlyDuesAlreadyPaid ? PaymentType.SPECIAL_CONTRIBUTION : PaymentType.MONTHLY_DUES,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMonthlyDuesSelected = isMonthlyDuesPaymentType(paymentType as PaymentType);
  const amount = resolveMemberPaymentFormAmount(
    paymentType as PaymentType,
    monthlyDuesAmount,
    editableAmount,
  );

  useEffect(() => {
    if (monthlyDuesAlreadyPaid && paymentType === PaymentType.MONTHLY_DUES) {
      setPaymentType(PaymentType.SPECIAL_CONTRIBUTION);
    }
  }, [monthlyDuesAlreadyPaid, paymentType]);

  useEffect(() => {
    if (isMonthlyDuesSelected) {
      setEditableAmount(formatPaymentAmountInput(monthlyDuesAmount));
    }
  }, [isMonthlyDuesSelected, monthlyDuesAmount]);

  const monthlyDuesBlocked =
    monthlyDuesAlreadyPaid && paymentType === PaymentType.MONTHLY_DUES;

  async function handlePayContribution() {
    setError(null);
    setIsSubmitting(true);

    try {
      const requestBody: {
        memberId: string;
        paymentType: string;
        amount?: number;
      } = {
        memberId,
        paymentType,
      };

      if (!isMonthlyDuesSelected) {
        requestBody.amount = Number(amount);
      } else {
        requestBody.amount = monthlyDuesAmount;
      }

      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
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
        submitError instanceof Error ? submitError.message : "Failed to start payment.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm">
      {monthlyDuesAlreadyPaid && monthlyDuesPaidMessage ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {monthlyDuesPaidMessage}
        </p>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pay-amount">Amount (GHS)</Label>
            <div className="relative">
              <Input
                id="pay-amount"
                type="number"
                min={1}
                step="0.01"
                value={amount}
                readOnly={isMonthlyDuesSelected}
                disabled={isMonthlyDuesSelected}
                aria-readonly={isMonthlyDuesSelected}
                className={isMonthlyDuesSelected ? "pr-10" : undefined}
                onChange={(event) => {
                  if (!isMonthlyDuesSelected) {
                    setEditableAmount(event.target.value);
                  }
                }}
              />
              {isMonthlyDuesSelected ? (
                <Lock
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
              ) : null}
            </div>
            {isMonthlyDuesSelected ? (
              <p className="text-xs text-muted-foreground">
                Monthly dues amount is configured by Welfare Administration.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Payment Type</Label>
            <Select
              value={paymentType}
              onValueChange={(value) => {
                const next = value ?? PaymentType.MONTHLY_DUES;
                setPaymentType(next);
                if (next === PaymentType.MONTHLY_DUES) {
                  setEditableAmount(formatPaymentAmountInput(monthlyDuesAmount));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue>{PAYMENT_TYPE_LABELS[paymentType as PaymentType]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.values(PaymentType).map((value) => (
                  <SelectItem
                    key={value}
                    value={value}
                    disabled={value === PaymentType.MONTHLY_DUES && monthlyDuesAlreadyPaid}
                  >
                    {PAYMENT_TYPE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <LoadingButton
            type="button"
            onClick={handlePayContribution}
            loading={isSubmitting}
            loadingText="Processing…"
            disabled={monthlyDuesBlocked}
            className="bg-[#166534] text-white hover:bg-[#14532d]"
          >
            <CreditCard className="size-4" />
            Pay Contribution
          </LoadingButton>
          <Link href="/payments" className={buttonVariants({ variant: "outline" })}>
            <History className="size-4" />
            Payment History
          </Link>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
