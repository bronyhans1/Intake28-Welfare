"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDisplayDate } from "@/lib/utils/format-date";
import {
  PAYMENT_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  PaymentCategory,
  PaymentMethod,
  PaymentStatus,
} from "@/types/enums";
import { resolvePaymentCategory } from "@/lib/payments/payment-category";
import type { PaymentListResult } from "@/lib/payments/repository";
import type { SerializedPayment } from "@/types/payment";

interface AdminPaymentsLedgerProps {
  data: PaymentListResult;
  search: string;
  paymentCategory?: string;
  paymentMethod?: string;
  status?: string;
}

function categoryLabel(payment: SerializedPayment): string {
  const category = resolvePaymentCategory(
    payment.paymentType,
    payment.paymentCategory,
  );
  return PAYMENT_CATEGORY_LABELS[category] ?? category;
}

export function AdminPaymentsLedger({
  data,
  search,
  paymentCategory = "",
  paymentMethod = "",
  status = "",
}: AdminPaymentsLedgerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(search);
  const [category, setCategory] = useState(paymentCategory);
  const [method, setMethod] = useState(paymentMethod);
  const [statusFilter, setStatusFilter] = useState(status);

  function applyFilters() {
    startTransition(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      if (category) params.set("paymentCategory", category);
      if (method) params.set("paymentMethod", method);
      if (statusFilter) params.set("status", statusFilter);
      const qs = params.toString();
      router.push(qs ? `/admin/payments?${qs}` : "/admin/payments");
    });
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Unified Payments Ledger</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1 space-y-2">
            <Label htmlFor="paymentSearch">
              Member, Claim Number, or Reference
            </Label>
            <Input
              id="paymentSearch"
              value={query}
              disabled={isPending}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters();
              }}
            />
          </div>
          <div className="min-w-[160px] space-y-2">
            <Label htmlFor="paymentCategory">Category</Label>
            <select
              id="paymentCategory"
              className="h-9 w-full rounded-lg border border-input px-2.5 text-sm"
              value={category}
              disabled={isPending}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">All categories</option>
              {Object.values(PaymentCategory).map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px] space-y-2">
            <Label htmlFor="paymentMethod">Method</Label>
            <select
              id="paymentMethod"
              className="h-9 w-full rounded-lg border border-input px-2.5 text-sm"
              value={method}
              disabled={isPending}
              onChange={(event) => setMethod(event.target.value)}
            >
              <option value="">All methods</option>
              {Object.values(PaymentMethod).map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_METHOD_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px] space-y-2">
            <Label htmlFor="paymentStatus">Status</Label>
            <select
              id="paymentStatus"
              className="h-9 w-full rounded-lg border border-input px-2.5 text-sm"
              value={statusFilter}
              disabled={isPending}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              {Object.values(PaymentStatus).map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <LoadingButton
            type="button"
            loading={isPending}
            className="bg-[#166534] text-white hover:bg-[#14532d]"
            onClick={applyFilters}
          >
            Apply
          </LoadingButton>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Payments ({data.total})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.records.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments found.</p>
          ) : (
            data.records.map((payment) => {
              const isClaim =
                resolvePaymentCategory(
                  payment.paymentType,
                  payment.paymentCategory,
                ) === PaymentCategory.CLAIM;

              return (
                <div
                  key={payment.id}
                  className="rounded-xl border border-black/[0.06] px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {payment.reference} · {categoryLabel(payment)}
                      </p>
                      <p className="text-muted-foreground">
                        {payment.memberName} ({payment.serviceNumber}) ·{" "}
                        {PAYMENT_TYPE_LABELS[payment.paymentType] ??
                          payment.paymentType}{" "}
                        · GHS {payment.amount.toFixed(2)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Status {PAYMENT_STATUS_LABELS[payment.status]} ·{" "}
                        {payment.paymentMethod
                          ? PAYMENT_METHOD_LABELS[payment.paymentMethod]
                          : "—"}{" "}
                        · Paid{" "}
                        {payment.paidAt
                          ? formatDisplayDate(payment.paidAt)
                          : "—"}
                        {payment.paidByName
                          ? ` · By ${payment.paidByName}`
                          : ""}
                      </p>
                      {isClaim ? (
                        <p className="mt-2 text-xs text-sky-900">
                          Claim {payment.claimNumber ?? "—"} ·{" "}
                          {payment.claimTypeDisplayName ?? "—"}
                          {payment.claimId ? (
                            <>
                              {" "}
                              ·{" "}
                              <Link
                                href={`/admin/claims/finance/${payment.claimId}`}
                                className="underline"
                              >
                                View claim
                              </Link>
                            </>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Process claim payments from the{" "}
        <Link href="/admin/claims/finance" className="text-[#166534] underline">
          Finance Claims
        </Link>{" "}
        queue.
      </p>
    </div>
  );
}
