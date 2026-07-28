"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Eye, Mail, Pencil, Search } from "lucide-react";
import { ActivationBadge } from "@/components/admin/member-badges";
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
import { formatDisplayDate } from "@/lib/utils/format-date";
import type { MemberListResult } from "@/lib/members/repository";
import { ActivationStatus } from "@/types/enums";

interface PendingMembersTableProps {
  data: MemberListResult;
  canManage: boolean;
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

  if ("search" in updates || "activationStatus" in updates) {
    params.set("page", "1");
  }

  return params.toString();
}

export function PendingMembersTable({ data, canManage }: PendingMembersTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlSearch = searchParams.get("search") ?? "";
  const urlActivation = searchParams.get("activationStatus") ?? FILTER_ALL;

  const [search, setSearch] = useState(urlSearch);
  const [activationStatus, setActivationStatus] = useState(urlActivation);

  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  useEffect(() => { setSearch(urlSearch); }, [urlSearch]);
  useEffect(() => { setActivationStatus(urlActivation); }, [urlActivation]);

  function updateFilters(updates: Record<string, string | undefined>) {
    startTransition(() => {
      router.push(`/admin/members/pending?${buildQuery(searchParams, updates)}`);
    });
  }

  useEffect(() => {
    if (search === urlSearch) return;
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.push(
          `/admin/members/pending?${buildQuery(searchParamsRef.current, { search: search || undefined })}`,
        );
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search, urlSearch, router]);

  function handleActivationChange(value: string | null) {
    const next = value ?? FILTER_ALL;
    setActivationStatus(next);
    updateFilters({
      activationStatus: next === FILTER_ALL ? undefined : next,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full max-w-sm space-y-1.5">
          <Label htmlFor="pending-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="pending-search"
              className="pl-8"
              placeholder="Search name, service number, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pending-activation">Activation Status</Label>
          <Select value={activationStatus} onValueChange={handleActivationChange}>
            <SelectTrigger id="pending-activation" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All Non-Activated</SelectItem>
              <SelectItem value={ActivationStatus.PENDING}>Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Service Number</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Activation Status</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No pending activation members found.
                </TableCell>
              </TableRow>
            ) : (
              data.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.fullName}</TableCell>
                  <TableCell>{member.serviceNumber}</TableCell>
                  <TableCell>{member.phoneNumber}</TableCell>
                  <TableCell>
                    <ActivationBadge activationStatus={member.activationStatus} />
                  </TableCell>
                  <TableCell>{formatDisplayDate(member.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/members/${member.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <Eye className="size-3.5" />
                        View
                      </Link>
                      {canManage ? (
                        <Link
                          href={`/admin/members/${member.id}/edit`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Link>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        title="Resend activation coming soon"
                      >
                        <Mail className="size-3.5" />
                        Resend
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          Showing {data.members.length} of {data.total} members
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
