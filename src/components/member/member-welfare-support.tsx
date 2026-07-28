import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SupportTypeBadge } from "@/components/admin/welfare-support-badge";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";
import type { SerializedWelfareSupport } from "@/types/welfare-support";

interface MemberWelfareSupportTableProps {
  records: SerializedWelfareSupport[];
}

export function MemberWelfareSupportTable({ records }: MemberWelfareSupportTableProps) {
  return (
    <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Support Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                No welfare support records found.
              </TableCell>
            </TableRow>
          ) : (
            records.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <SupportTypeBadge supportType={record.supportType} />
                </TableCell>
                <TableCell className="font-medium text-[#166534]">
                  {formatCurrency(record.amount)}
                </TableCell>
                <TableCell>{record.description}</TableCell>
                <TableCell>{formatDisplayDate(record.createdAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

interface RecentWelfareSupportProps {
  records: SerializedWelfareSupport[];
}

export function RecentWelfareSupport({ records }: RecentWelfareSupportProps) {
  const recent = records.slice(0, 5);

  return (
    <div className="space-y-3">
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">No welfare support records yet.</p>
      ) : (
        recent.map((record) => (
          <div
            key={record.id}
            className="flex flex-col gap-1 rounded-xl border border-black/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <SupportTypeBadge supportType={record.supportType} />
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {record.description}
              </p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-[#166534]">{formatCurrency(record.amount)}</p>
              <p className="text-xs text-muted-foreground">
                {formatDisplayDate(record.createdAt)}
              </p>
            </div>
          </div>
        ))
      )}
      {records.length > 0 ? (
        <Link
          href="/portal/welfare-support"
          className="inline-flex text-sm font-medium text-[#166534] hover:underline"
        >
          View all welfare support →
        </Link>
      ) : null}
    </div>
  );
}
