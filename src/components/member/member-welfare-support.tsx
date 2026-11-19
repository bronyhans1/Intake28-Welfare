import Link from "next/link";
import {
  ClaimBenefitTypeBadge,
  SupportTypeBadge,
  WelfareHistorySourceBadge,
  WelfareHistoryStatusBadge,
} from "@/components/admin/welfare-support-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";
import type { WelfareHistoryEntry } from "@/types/welfare-history";

interface MemberWelfareSupportTableProps {
  entries: WelfareHistoryEntry[];
  supportTypeLabelMap?: Record<string, string>;
}

export function MemberWelfareSupportTable({
  entries,
  supportTypeLabelMap,
}: MemberWelfareSupportTableProps) {
  return (
    <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Benefit / Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                No welfare assistance or paid benefits found.
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  {entry.source === "welfare_support" && entry.supportTypeCode ? (
                    <SupportTypeBadge
                      supportType={entry.supportTypeCode}
                      labelMap={supportTypeLabelMap}
                    />
                  ) : (
                    <ClaimBenefitTypeBadge label={entry.benefitTypeLabel} />
                  )}
                </TableCell>
                <TableCell className="font-medium text-[#166534]">
                  {formatCurrency(entry.amount)}
                </TableCell>
                <TableCell>
                  <WelfareHistoryStatusBadge statusLabel={entry.statusLabel} />
                </TableCell>
                <TableCell>
                  <WelfareHistorySourceBadge source={entry.source} />
                </TableCell>
                <TableCell>{formatDisplayDate(entry.occurredAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

interface RecentWelfareSupportProps {
  entries: WelfareHistoryEntry[];
  supportTypeLabelMap?: Record<string, string>;
}

export function RecentWelfareSupport({
  entries,
  supportTypeLabelMap,
}: RecentWelfareSupportProps) {
  const recent = entries.slice(0, 5);

  return (
    <div className="space-y-3">
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No welfare assistance or paid benefits yet.
        </p>
      ) : (
        recent.map((entry) => (
          <div
            key={entry.id}
            className="flex flex-col gap-1 rounded-xl border border-black/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              {entry.source === "welfare_support" && entry.supportTypeCode ? (
                <SupportTypeBadge
                  supportType={entry.supportTypeCode}
                  labelMap={supportTypeLabelMap}
                />
              ) : (
                <ClaimBenefitTypeBadge label={entry.benefitTypeLabel} />
              )}
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {entry.source === "claim_payment"
                  ? `Claim Payment · ${entry.statusLabel}`
                  : entry.description}
              </p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-[#166534]">{formatCurrency(entry.amount)}</p>
              <p className="text-xs text-muted-foreground">
                {formatDisplayDate(entry.occurredAt)}
              </p>
            </div>
          </div>
        ))
      )}
      {entries.length > 0 ? (
        <Link
          href="/portal/welfare-support"
          className="inline-flex text-sm font-medium text-[#166534] hover:underline"
        >
          View all welfare history →
        </Link>
      ) : null}
    </div>
  );
}
