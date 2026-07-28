"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { MoreHorizontal, Search } from "lucide-react";
import {
  activateMemberAction,
  deactivateMemberAction,
  resetMemberActivationAction,
  suspendMemberAction,
} from "@/actions/members";
import { MemberAvatar } from "@/components/admin/member-avatar";
import {
  ActivationBadge,
  RoleBadge,
  StatusBadge,
} from "@/components/admin/member-badges";
import { useToast } from "@/components/providers/toast-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ActivationStatus, UserRole, UserStatus } from "@/types/enums";
import type { SerializedMember } from "@/types/user";

interface MembersTableProps {
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

  if ("activationStatus" in updates) {
    params.delete("activation");
  }

  if (
    "search" in updates ||
    "role" in updates ||
    "status" in updates ||
    "activationStatus" in updates
  ) {
    params.set("page", "1");
  }

  return params.toString();
}

function MemberRowActions({
  member,
  canManage,
}: {
  member: SerializedMember;
  canManage: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { showSuccess, showError } = useToast();
  const [pendingAction, setPendingAction] = useState<
    "reset-activation" | "suspend" | "deactivate" | "activate" | null
  >(null);

  if (!canManage) {
    return (
      <Link
        href={`/admin/members/${member.id}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        View
      </Link>
    );
  }

  function runAction(
    type: "reset-activation" | "suspend" | "deactivate" | "activate",
    action: () => Promise<{ error?: string; success?: boolean }>,
    successMessage: string,
  ) {
    setPendingAction(type);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) {
          showError(result.error);
          return;
        }
        showSuccess(successMessage);
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  const isBusy = pendingAction != null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={isBusy}>
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Actions</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/admin/members/${member.id}`)}>
          View
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push(`/admin/members/${member.id}/edit`)}
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isBusy}
          onClick={() =>
            runAction(
              "reset-activation",
              () => resetMemberActivationAction(member.id),
              "Member activation reset successfully.",
            )
          }
        >
          {pendingAction === "reset-activation"
            ? "Resetting Activation..."
            : "Reset Activation"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isBusy}
          className="text-amber-800 focus:text-amber-900"
          onClick={() =>
            runAction(
              "suspend",
              () => suspendMemberAction(member.id),
              "Member suspended successfully.",
            )
          }
        >
          {pendingAction === "suspend" ? "Suspending..." : "Suspend"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isBusy}
          className="text-amber-800 focus:text-amber-900"
          onClick={() =>
            runAction(
              "deactivate",
              () => deactivateMemberAction(member.id),
              "Member deactivated successfully.",
            )
          }
        >
          {pendingAction === "deactivate" ? "Deactivating..." : "Deactivate"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isBusy}
          className="text-emerald-800 focus:text-emerald-900"
          onClick={() =>
            runAction(
              "activate",
              () => activateMemberAction(member.id),
              "Member activated successfully.",
            )
          }
        >
          {pendingAction === "activate" ? "Activating..." : "Activate"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MembersTable({ data, canManage }: MembersTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlSearch = searchParams.get("search") ?? "";
  const urlRole = searchParams.get("role") ?? FILTER_ALL;
  const urlStatus = searchParams.get("status") ?? FILTER_ALL;
  const urlActivation =
    searchParams.get("activationStatus") ??
    searchParams.get("activation") ??
    FILTER_ALL;

  const [search, setSearch] = useState(urlSearch);
  const [role, setRole] = useState(urlRole);
  const [status, setStatus] = useState(urlStatus);
  const [activationStatus, setActivationStatus] = useState(urlActivation);
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    setRole(urlRole);
  }, [urlRole]);

  useEffect(() => {
    setStatus(urlStatus);
  }, [urlStatus]);

  useEffect(() => {
    setActivationStatus(urlActivation);
  }, [urlActivation]);

  function updateFilters(updates: Record<string, string | undefined>) {
    startTransition(() => {
      router.push(`/admin/members?${buildQuery(searchParams, updates)}`);
    });
  }

  useEffect(() => {
    if (search === urlSearch) {
      return;
    }

    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.push(
          `/admin/members?${buildQuery(searchParamsRef.current, {
            search: search || undefined,
          })}`,
        );
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [search, urlSearch, router]);

  function handleRoleChange(value: string | null) {
    const next = value ?? FILTER_ALL;
    setRole(next);
    updateFilters({ role: next === FILTER_ALL ? undefined : next });
  }

  function handleStatusChange(value: string | null) {
    const next = value ?? FILTER_ALL;
    setStatus(next);
    updateFilters({ status: next === FILTER_ALL ? undefined : next });
  }

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
          <Label htmlFor="member-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="member-search"
              className="pl-8"
              placeholder="Search name, service number, phone…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                }
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="member-filter-status">Status</Label>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger id="member-filter-status" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>All Statuses</SelectItem>
                <SelectItem value={UserStatus.ACTIVE}>Active</SelectItem>
                <SelectItem value={UserStatus.INACTIVE}>Inactive</SelectItem>
                <SelectItem value={UserStatus.SUSPENDED}>Suspended</SelectItem>
                <SelectItem value={UserStatus.DEACTIVATED}>Deactivated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="member-filter-role">Role</Label>
            <Select value={role} onValueChange={handleRoleChange}>
              <SelectTrigger id="member-filter-role" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>All Roles</SelectItem>
                <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                <SelectItem value={UserRole.TREASURER}>Treasurer</SelectItem>
                <SelectItem value={UserRole.MEMBER}>Member</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="member-filter-activation">Activation</Label>
            <Select
              value={activationStatus}
              onValueChange={handleActivationChange}
            >
              <SelectTrigger id="member-filter-activation" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>All Activation States</SelectItem>
                <SelectItem value={ActivationStatus.PENDING}>Pending</SelectItem>
                <SelectItem value={ActivationStatus.ACTIVATED}>Activated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Photo</TableHead>
              <TableHead>Service Number</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Activation</TableHead>
              <TableHead>Profile %</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  No members found.
                </TableCell>
              </TableRow>
            ) : (
              data.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <MemberAvatar
                      fullName={member.fullName}
                      profilePhotoUrl={member.profilePhotoUrl}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{member.serviceNumber}</TableCell>
                  <TableCell>{member.fullName}</TableCell>
                  <TableCell>{member.phoneNumber}</TableCell>
                  <TableCell>
                    <RoleBadge role={member.role} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={member.status} />
                  </TableCell>
                  <TableCell>
                    <ActivationBadge activationStatus={member.activationStatus} />
                  </TableCell>
                  <TableCell>{member.profileCompletionPercentage}%</TableCell>
                  <TableCell>{formatDisplayDate(member.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <MemberRowActions member={member} canManage={canManage} />
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
            onClick={() =>
              updateFilters({ page: String(Math.max(1, data.page - 1)) })
            }
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
