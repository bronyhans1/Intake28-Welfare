"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { AUDIT_ACTION_OPTIONS } from "@/lib/audit/labels";
import type { AuditLogListResult } from "@/lib/audit/repository";
import { AuditLogTextCell } from "@/components/admin/audit-log-text-cell";
import { formatDisplayDate } from "@/lib/utils/format-date";

interface AuditLogsTableProps {
  data: AuditLogListResult;
}

const SEARCH_DEBOUNCE_MS = 400;
const FILTER_ALL = "all";

function buildQuery(
  searchParams: URLSearchParams,
  updates: Record<string, string | undefined>,
) {
  const params = new URLSearchParams(searchParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (!value) params.delete(key);
    else params.set(key, value);
  }

  if (
    "search" in updates ||
    "action" in updates ||
    "actor" in updates ||
    "dateFrom" in updates ||
    "dateTo" in updates
  ) {
    params.set("page", "1");
  }

  return params.toString();
}

export function AuditLogsTable({ data }: AuditLogsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlSearch = searchParams.get("search") ?? "";
  const urlAction = searchParams.get("action") ?? FILTER_ALL;
  const urlActor = searchParams.get("actor") ?? "";
  const urlDateFrom = searchParams.get("dateFrom") ?? "";
  const urlDateTo = searchParams.get("dateTo") ?? "";

  const [search, setSearch] = useState(urlSearch);
  const [action, setAction] = useState(urlAction);
  const [actor, setActor] = useState(urlActor);
  const [dateFrom, setDateFrom] = useState(urlDateFrom);
  const [dateTo, setDateTo] = useState(urlDateTo);

  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  useEffect(() => { setSearch(urlSearch); }, [urlSearch]);
  useEffect(() => { setAction(urlAction); }, [urlAction]);
  useEffect(() => { setActor(urlActor); }, [urlActor]);
  useEffect(() => { setDateFrom(urlDateFrom); }, [urlDateFrom]);
  useEffect(() => { setDateTo(urlDateTo); }, [urlDateTo]);

  function updateFilters(updates: Record<string, string | undefined>) {
    startTransition(() => {
      router.push(`/admin/audit-logs?${buildQuery(searchParams, updates)}`);
    });
  }

  useEffect(() => {
    if (search === urlSearch) return;
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.push(
          `/admin/audit-logs?${buildQuery(searchParamsRef.current, { search: search || undefined })}`,
        );
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search, urlSearch, router]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="audit-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="audit-search"
              className="pl-8"
              placeholder="Search action, actor, entity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audit-action">Action Type</Label>
          <Select
            value={action}
            onValueChange={(value: string | null) => {
              const next = value ?? FILTER_ALL;
              setAction(next);
              updateFilters({ action: next === FILTER_ALL ? undefined : next });
            }}
          >
            <SelectTrigger id="audit-action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All Actions</SelectItem>
              {AUDIT_ACTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audit-actor">Actor</Label>
          <Input
            id="audit-actor"
            placeholder="Filter by actor name"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            onBlur={() => updateFilters({ actor: actor || undefined })}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="audit-date-from">From</Label>
            <Input
              id="audit-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                updateFilters({ dateFrom: e.target.value || undefined });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-date-to">To</Label>
            <Input
              id="audit-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                updateFilters({ dateTo: e.target.value || undefined });
              }}
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/[0.08] bg-white shadow-sm">
        <Table className="min-w-[960px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[10rem] whitespace-nowrap">Action</TableHead>
              <TableHead className="min-w-[8rem] whitespace-nowrap">Actor</TableHead>
              <TableHead className="min-w-[8rem] whitespace-nowrap">Date</TableHead>
              <TableHead className="min-w-[12rem] whitespace-nowrap">Target Entity</TableHead>
              <TableHead className="min-w-[16rem] whitespace-nowrap">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No audit logs found.
                </TableCell>
              </TableRow>
            ) : (
              data.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium whitespace-nowrap">{log.label}</TableCell>
                  <TableCell className="whitespace-nowrap">{log.actorDisplayName}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDisplayDate(log.createdAt)}</TableCell>
                  <TableCell>
                    <AuditLogTextCell value={log.entityLabel} label="Target Entity" />
                  </TableCell>
                  <TableCell>
                    <AuditLogTextCell value={log.description} label="Description" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          Showing {data.logs.length} of {data.total} logs
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={data.page <= 1 || isPending}
            onClick={() => updateFilters({ page: String(Math.max(1, data.page - 1)) })}
          >
            Previous
          </Button>
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={data.page >= data.totalPages || isPending}
            onClick={() =>
              updateFilters({ page: String(Math.min(data.totalPages, data.page + 1)) })
            }
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
