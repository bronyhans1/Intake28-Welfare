"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import type { DefaulterListResult } from "@/lib/finance/defaulters";

interface DefaultersTableProps {
  data: DefaulterListResult;
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

export function DefaultersTable({ data }: DefaultersTableProps) {
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
          `/admin/finance/defaulters?${buildQuery(searchParamsRef.current, {
            search: search || undefined,
          })}`,
        );
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [search, urlSearch, router]);

  function goToPage(page: number) {
    startTransition(() => {
      router.push(
        `/admin/finance/defaulters?${buildQuery(searchParams, { page: String(page) })}`,
      );
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="defaulter-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="defaulter-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by member name or service number"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Outstanding Months</TableHead>
              <TableHead>Months Owing</TableHead>
              <TableHead>Outstanding Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.records.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No members with outstanding contributions.
                </TableCell>
              </TableRow>
            ) : (
              data.records.map((record) => (
                <TableRow key={record.memberId}>
                  <TableCell>
                    <Link
                      href={`/admin/members/${record.memberId}`}
                      className="font-medium text-[#166534] hover:underline"
                    >
                      {record.fullName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {record.serviceNumber}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-[18rem] text-sm">
                    {record.outstandingMonthsDisplay}
                  </TableCell>
                  <TableCell>{record.outstandingMonths}</TableCell>
                  <TableCell className="font-medium text-[#166534]">
                    {formatCurrency(record.outstandingAmount)}
                  </TableCell>
                  <TableCell>{record.membershipStatusLabel}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages} ({data.total} members)
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
