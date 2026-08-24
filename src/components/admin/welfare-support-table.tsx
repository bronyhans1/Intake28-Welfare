"use client";



import Link from "next/link";

import { useRouter, useSearchParams } from "next/navigation";

import { useEffect, useRef, useState, useTransition } from "react";

import { Eye, Pencil, Search } from "lucide-react";

import {

  ClaimBenefitTypeBadge,

  SupportStatusBadge,

  SupportTypeBadge,

  WelfareHistorySourceBadge,

  WelfareHistoryStatusBadge,

} from "@/components/admin/welfare-support-badge";

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

import { formatDisplayDate } from "@/lib/utils/format-date";

import { formatCurrency } from "@/lib/utils/currency";

import type { WelfareHistoryListResult } from "@/types/welfare-history";

import { WelfareSupportStatus } from "@/types/enums";

import type { WelfareSupportTypeOption } from "@/types/welfare-support-type";



interface WelfareSupportTableProps {

  data: WelfareHistoryListResult;

  canManage: boolean;

  supportTypes: WelfareSupportTypeOption[];

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

  if (

    "search" in updates ||

    "source" in updates ||

    "supportType" in updates ||

    "status" in updates

  ) {

    params.set("page", "1");

  }

  return params.toString();

}



export function WelfareSupportTable({

  data,

  canManage,

  supportTypes,

}: WelfareSupportTableProps) {

  const router = useRouter();

  const searchParams = useSearchParams();

  const [isPending, startTransition] = useTransition();



  const urlSearch = searchParams.get("search") ?? "";

  const urlSource = searchParams.get("source") ?? FILTER_ALL;

  const urlType = searchParams.get("supportType") ?? FILTER_ALL;

  const urlStatus = searchParams.get("status") ?? FILTER_ALL;

  const labelMap = Object.fromEntries(

    supportTypes.map((type) => [type.code, type.displayName]),

  );



  const [search, setSearch] = useState(urlSearch);

  const [source, setSource] = useState(urlSource);

  const [supportType, setSupportType] = useState(urlType);

  const [status, setStatus] = useState(urlStatus);



  const searchParamsRef = useRef(searchParams);

  searchParamsRef.current = searchParams;



  useEffect(() => { setSearch(urlSearch); }, [urlSearch]);

  useEffect(() => { setSource(urlSource); }, [urlSource]);

  useEffect(() => { setSupportType(urlType); }, [urlType]);

  useEffect(() => { setStatus(urlStatus); }, [urlStatus]);



  function updateFilters(updates: Record<string, string | undefined>) {

    startTransition(() => {

      router.push(`/admin/welfare-support?${buildQuery(searchParams, updates)}`);

    });

  }



  useEffect(() => {

    if (search === urlSearch) return;

    const timer = window.setTimeout(() => {

      startTransition(() => {

        router.push(

          `/admin/welfare-support?${buildQuery(searchParamsRef.current, { search: search || undefined })}`,

        );

      });

    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);

  }, [search, urlSearch, router]);



  function handleSourceChange(value: string | null) {

    const next = value ?? FILTER_ALL;

    setSource(next);

    updateFilters({ source: next === FILTER_ALL ? undefined : next });

  }



  function handleTypeChange(value: string | null) {

    const next = value ?? FILTER_ALL;

    setSupportType(next);

    updateFilters({ supportType: next === FILTER_ALL ? undefined : next });

  }



  function handleStatusChange(value: string | null) {

    const next = value ?? FILTER_ALL;

    setStatus(next);

    updateFilters({ status: next === FILTER_ALL ? undefined : next });

  }



  const showSupportTypeFilter =

    source === FILTER_ALL || source === "welfare_support";



  return (

    <div className="space-y-4">

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

        <div className="w-full max-w-sm space-y-1.5">

          <Label htmlFor="ws-search">Search</Label>

          <div className="relative">

            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input

              id="ws-search"

              className="pl-8"

              placeholder="Search member, service number, claim…"

              value={search}

              onChange={(e) => setSearch(e.target.value)}

              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}

            />

          </div>

        </div>



        <div className="flex flex-wrap gap-3">

          <div className="space-y-1.5">

            <Label htmlFor="ws-filter-source">Source</Label>

            <Select value={source} onValueChange={handleSourceChange}>

              <SelectTrigger id="ws-filter-source" className="w-[180px]">

                <SelectValue />

              </SelectTrigger>

              <SelectContent>

                <SelectItem value={FILTER_ALL}>All Sources</SelectItem>

                <SelectItem value="claim_payment">Claim Payment</SelectItem>

                <SelectItem value="welfare_support">Welfare Support</SelectItem>

              </SelectContent>

            </Select>

          </div>



          {showSupportTypeFilter ? (

            <div className="space-y-1.5">

              <Label htmlFor="ws-filter-type">Support Type</Label>

              <Select value={supportType} onValueChange={handleTypeChange}>

                <SelectTrigger id="ws-filter-type" className="w-[200px]">

                  <SelectValue />

                </SelectTrigger>

                <SelectContent>

                  <SelectItem value={FILTER_ALL}>All Types</SelectItem>

                  {supportTypes.map((type) => (

                    <SelectItem key={type.code} value={type.code}>

                      {type.displayName}

                      {!type.active ? " (inactive)" : ""}

                    </SelectItem>

                  ))}

                </SelectContent>

              </Select>

            </div>

          ) : null}



          <div className="space-y-1.5">

            <Label htmlFor="ws-filter-status">Status</Label>

            <Select value={status} onValueChange={handleStatusChange}>

              <SelectTrigger id="ws-filter-status" className="w-[140px]">

                <SelectValue />

              </SelectTrigger>

              <SelectContent>

                <SelectItem value={FILTER_ALL}>All Statuses</SelectItem>

                <SelectItem value={WelfareSupportStatus.APPROVED}>Approved</SelectItem>

                <SelectItem value={WelfareSupportStatus.PENDING}>Pending</SelectItem>

                <SelectItem value={WelfareSupportStatus.PAID}>Paid</SelectItem>

                <SelectItem value={WelfareSupportStatus.CANCELLED}>Cancelled</SelectItem>

              </SelectContent>

            </Select>

          </div>

        </div>

      </div>



      <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm">

        <Table>

          <TableHeader>

            <TableRow>

              <TableHead>Member</TableHead>

              <TableHead>Service Number</TableHead>

              <TableHead>Benefit / Type</TableHead>

              <TableHead>Amount</TableHead>

              <TableHead>Status</TableHead>

              <TableHead>Source</TableHead>

              <TableHead>Recorded / Paid By</TableHead>

              <TableHead>Date</TableHead>

              <TableHead className="text-right">Actions</TableHead>

            </TableRow>

          </TableHeader>

          <TableBody>

            {data.entries.length === 0 ? (

              <TableRow>

                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">

                  No welfare records found.

                </TableCell>

              </TableRow>

            ) : (

              data.entries.map((entry) => (

                <TableRow key={entry.id}>

                  <TableCell className="font-medium">{entry.memberName}</TableCell>

                  <TableCell>{entry.serviceNumber}</TableCell>

                  <TableCell>

                    {entry.source === "welfare_support" && entry.supportTypeCode ? (

                      <SupportTypeBadge

                        supportType={entry.supportTypeCode}

                        labelMap={labelMap}

                      />

                    ) : (

                      <ClaimBenefitTypeBadge label={entry.benefitTypeLabel} />

                    )}

                  </TableCell>

                  <TableCell>{formatCurrency(entry.amount)}</TableCell>

                  <TableCell>

                    {entry.source === "welfare_support" &&

                    entry.welfareSupportStatus ? (

                      <SupportStatusBadge status={entry.welfareSupportStatus} />

                    ) : (

                      <WelfareHistoryStatusBadge statusLabel={entry.statusLabel} />

                    )}

                  </TableCell>

                  <TableCell>

                    <WelfareHistorySourceBadge source={entry.source} />

                  </TableCell>

                  <TableCell>{entry.recordedByName}</TableCell>

                  <TableCell>{formatDisplayDate(entry.occurredAt)}</TableCell>

                  <TableCell className="text-right">

                    <div className="flex justify-end gap-2">

                      {entry.source === "claim_payment" && entry.claimId ? (

                        <Link

                          href={`/admin/claims/finance/${entry.claimId}`}

                          className={buttonVariants({ variant: "outline", size: "sm" })}

                          aria-label={`View claim payment for ${entry.memberName}`}

                        >

                          <Eye className="size-3.5" />

                          View

                        </Link>

                      ) : entry.welfareSupportId ? (

                        <Link

                          href={`/admin/welfare-support/${entry.welfareSupportId}`}

                          className={buttonVariants({ variant: "outline", size: "sm" })}

                          aria-label={`View welfare support record for ${entry.memberName}`}

                        >

                          <Eye className="size-3.5" />

                          View

                        </Link>

                      ) : null}

                      {canManage && entry.welfareSupportId ? (

                        <Link

                          href={`/admin/welfare-support/${entry.welfareSupportId}/edit`}

                          className={buttonVariants({ variant: "outline", size: "sm" })}

                          aria-label={`Edit welfare support record for ${entry.memberName}`}

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



      <div className="flex items-center justify-between text-sm text-muted-foreground">

        <p>

          Showing {data.entries.length} of {data.total} records

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

