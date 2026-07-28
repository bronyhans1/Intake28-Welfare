"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { ReceiptDownloadButton } from "@/components/member/receipt-download-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatReceiptContributionTypeLabel } from "@/lib/receipts/labels";
import type { ReceiptListResult } from "@/lib/receipts/repository";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";

interface MemberReceiptsTableProps {
  data: ReceiptListResult;
}

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

  if ("search" in updates) {
    params.set("page", "1");
  }

  return params.toString();
}

export function MemberReceiptsTable({ data }: MemberReceiptsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const urlSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(urlSearch);
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    if (search === urlSearch) return;
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.push(
          `/receipts?${buildQuery(searchParamsRef.current, {
            search: search || undefined,
          })}`,
        );
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search, urlSearch, router]);

  function goToPage(page: number) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(page));
      router.push(`/receipts?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="receipt-search">Search</Label>
        <div className="relative max-w-md">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="receipt-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Receipt number, payment reference…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt Number</TableHead>
              <TableHead>Contribution Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date Issued</TableHead>
              <TableHead className="text-right">Download</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No receipts found.
                </TableCell>
              </TableRow>
            ) : (
              data.records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.receiptNumber}</TableCell>
                  <TableCell>
                    {formatReceiptContributionTypeLabel(record.contributionType)}
                  </TableCell>
                  <TableCell>{formatCurrency(record.amount)}</TableCell>
                  <TableCell>{formatDisplayDate(record.issuedAt)}</TableCell>
                  <TableCell className="text-right">
                    <ReceiptDownloadButton
                      receiptId={record.id}
                      receiptNumber={record.receiptNumber}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Page {data.page} of {data.totalPages} ({data.total} total)
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
