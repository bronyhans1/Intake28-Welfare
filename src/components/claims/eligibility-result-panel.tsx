"use client";

import type { MemberEligibilityResult } from "@/lib/claims/eligibility-engine";

interface EligibilityResultPanelProps {
  result: MemberEligibilityResult;
  /** Optional member context for admin view */
  memberLabel?: string | null;
  compact?: boolean;
}

export function EligibilityResultPanel({
  result,
  memberLabel,
}: EligibilityResultPanelProps) {
  return (
    <div className="space-y-4 rounded-xl border border-black/[0.08] bg-slate-50/80 px-4 py-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Eligibility Result
        </h3>
        {memberLabel ? (
          <p className="mt-1 text-sm text-muted-foreground">{memberLabel}</p>
        ) : null}
      </div>

      <ul className="space-y-1.5 text-sm">
        {result.checks.map((check) => (
          <li key={check.key} className="flex items-start gap-2">
            <span
              className={
                check.passed ? "text-emerald-700" : "text-rose-700"
              }
              aria-hidden
            >
              {check.passed ? "✓" : "✗"}
            </span>
            <span className="text-foreground">{check.label}</span>
          </li>
        ))}
      </ul>

      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <p className="text-muted-foreground">Member Status</p>
          <p className="font-medium text-foreground">{result.memberStatus}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Benefit Percentage</p>
          <p className="font-medium text-foreground">
            {result.benefitPercentage}%
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-muted-foreground">Constitution</p>
          <p className="font-medium text-foreground">
            {result.constitutionVersion || "—"}
          </p>
        </div>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">Overall Status</p>
        <p
          className={
            result.eligible
              ? "text-base font-semibold text-emerald-800"
              : "text-base font-semibold text-rose-800"
          }
        >
          {result.eligible ? "Eligible" : "Not Eligible"}
        </p>
      </div>

      {!result.eligible && result.reasons.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-foreground">Reasons</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-rose-900">
            {result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.warnings.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-foreground">Warnings</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
