"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Eye, Pencil, Search } from "lucide-react";
import {
  AnnouncementAudienceBadge,
  AnnouncementStatusBadge,
} from "@/components/admin/announcements-badge";
import { buttonVariants } from "@/components/ui/button";
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
import { Button } from "@/components/ui/button";
import type { AnnouncementListResult } from "@/lib/announcements/repository";
import {
  formatAnnouncementAudienceFilterLabel,
  formatAnnouncementStatusFilterLabel,
} from "@/lib/announcements/labels";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { AnnouncementAudience, AnnouncementStatus } from "@/types/enums";

interface AnnouncementsTableProps {
  data: AnnouncementListResult;
  canManage: boolean;
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

  if ("search" in updates || "audience" in updates || "status" in updates) {
    params.set("page", "1");
  }

  return params.toString();
}

export function AnnouncementsTable({ data, canManage }: AnnouncementsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlSearch = searchParams.get("search") ?? "";
  const urlAudience = searchParams.get("audience") ?? FILTER_ALL;
  const urlStatus = searchParams.get("status") ?? FILTER_ALL;

  const [search, setSearch] = useState(urlSearch);
  const [audience, setAudience] = useState(urlAudience);
  const [status, setStatus] = useState(urlStatus);

  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  useEffect(() => { setSearch(urlSearch); }, [urlSearch]);
  useEffect(() => { setAudience(urlAudience); }, [urlAudience]);
  useEffect(() => { setStatus(urlStatus); }, [urlStatus]);

  function updateFilters(updates: Record<string, string | undefined>) {
    startTransition(() => {
      router.push(`/admin/announcements?${buildQuery(searchParams, updates)}`);
    });
  }

  useEffect(() => {
    if (search === urlSearch) return;
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.push(
          `/admin/announcements?${buildQuery(searchParamsRef.current, {
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
        `/admin/announcements?${buildQuery(searchParams, { page: String(page) })}`,
      );
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2 md:col-span-1">
          <Label htmlFor="announcement-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="announcement-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, message, or creator"
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Audience</Label>
          <Select
            value={audience}
            onValueChange={(value) => {
              const next = value ?? FILTER_ALL;
              setAudience(next);
              updateFilters({ audience: next === FILTER_ALL ? undefined : next });
            }}
          >
            <SelectTrigger>
              <SelectValue>
                {formatAnnouncementAudienceFilterLabel(audience)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>
                {formatAnnouncementAudienceFilterLabel(FILTER_ALL)}
              </SelectItem>
              {Object.values(AnnouncementAudience).map((value) => (
                <SelectItem key={value} value={value}>
                  {formatAnnouncementAudienceFilterLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              <SelectValue>
                {formatAnnouncementStatusFilterLabel(status)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>
                {formatAnnouncementStatusFilterLabel(FILTER_ALL)}
              </SelectItem>
              {Object.values(AnnouncementStatus).map((value) => (
                <SelectItem key={value} value={value}>
                  {formatAnnouncementStatusFilterLabel(value)}
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
              <TableHead>Title</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Published Date</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No announcements found.
                </TableCell>
              </TableRow>
            ) : (
              data.records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="max-w-xs font-medium">
                    <span className="line-clamp-2">{record.title}</span>
                  </TableCell>
                  <TableCell>
                    <AnnouncementAudienceBadge audience={record.audience} />
                  </TableCell>
                  <TableCell>
                    <AnnouncementStatusBadge status={record.status} />
                  </TableCell>
                  <TableCell>
                    {record.publishedAt ? formatDisplayDate(record.publishedAt) : "—"}
                  </TableCell>
                  <TableCell>{record.createdByName}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/announcements/${record.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <Eye className="size-3.5" />
                        View
                      </Link>
                      {canManage ? (
                        <Link
                          href={`/admin/announcements/${record.id}/edit`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Link>
                      ) : null}
                    </div>
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
            Page {data.page} of {data.totalPages} ({data.total} announcements)
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
