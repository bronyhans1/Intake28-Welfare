import Link from "next/link";
import {
  ClaimBenefitTypeBadge,
  WelfareHistoryStatusBadge,
} from "@/components/admin/welfare-support-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildWelfareRecordsPayDeskUrl } from "@/lib/claims/claim-repository";
import { formatCurrency } from "@/lib/utils/currency";
import { CLAIM_STATUS_LABELS } from "@/types/enums";
import type { SerializedClaim } from "@/types/claims";
import { cn } from "@/lib/utils";

interface AwaitingPaymentClaimsPanelProps {
  claims: SerializedClaim[];
  canPay: boolean;
}

export function AwaitingPaymentClaimsPanel({
  claims,
  canPay,
}: AwaitingPaymentClaimsPanelProps) {
  const count = claims.length;

  return (
    <Card className="rounded-2xl border border-amber-200/80 bg-amber-50/30 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Awaiting Payment{count > 0 ? ` (${count})` : ""}
        </CardTitle>
        <CardDescription>
          Approved member claims waiting for Treasurer payment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-muted-foreground">
            No claims are currently awaiting payment.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-black/[0.08] bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Service Number</TableHead>
                  <TableHead>Claim Type</TableHead>
                  <TableHead>Claim No.</TableHead>
                  <TableHead>Approved Amount</TableHead>
                  <TableHead>Status</TableHead>
                  {canPay ? <TableHead className="text-right">Action</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium">{claim.memberName}</TableCell>
                    <TableCell>{claim.serviceNumber}</TableCell>
                    <TableCell>
                      <ClaimBenefitTypeBadge
                        label={claim.claimTypeDisplayName ?? claim.claimTypeCode}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {claim.claimNumber ?? claim.reference ?? "—"}
                    </TableCell>
                    <TableCell className="font-medium text-[#166534]">
                      {formatCurrency(claim.approvedBenefitAmount ?? 0)}
                    </TableCell>
                    <TableCell>
                      <WelfareHistoryStatusBadge
                        statusLabel={CLAIM_STATUS_LABELS[claim.status]}
                      />
                    </TableCell>
                    {canPay ? (
                      <TableCell className="text-right">
                        <Link
                          href={buildWelfareRecordsPayDeskUrl(
                            claim.memberId,
                            claim.id,
                          )}
                          className={cn(
                            buttonVariants({
                              size: "sm",
                              className: "bg-[#166534] text-white hover:bg-[#14532d]",
                            }),
                          )}
                        >
                          Pay Now
                        </Link>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
