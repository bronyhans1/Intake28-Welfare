"use client";

import type { ClaimSubmissionEligibilityResult } from "@/lib/claims/claim-progression";

interface AutomaticEligibilityBannerProps {
  result: ClaimSubmissionEligibilityResult | null;
  loading?: boolean;
  error?: string | null;
}

/**
 * Compact automatic eligibility summary shown when a claim draft is opened.
 * Progression values come from Membership Progression Engine (Phase 3B).
 */
export function AutomaticEligibilityBanner({
  result,
  loading,
  error,
}: AutomaticEligibilityBannerProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-black/[0.08] bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
        Checking eligibility…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
        {error}
      </div>
    );
  }

  if (!result) return null;

  if (result.eligible) {
    return (
      <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-4">
        <p className="text-sm font-semibold text-emerald-900">
          You are eligible to submit this claim.
        </p>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="text-emerald-800/80">Welfare Points</p>
            <p className="font-medium text-emerald-950">{result.welfarePoints}</p>
          </div>
          <div>
            <p className="text-emerald-800/80">Benefit Percentage</p>
            <p className="font-medium text-emerald-950">
              {result.benefitPercentage}%
            </p>
          </div>
          <div>
            <p className="text-emerald-800/80">Membership Status</p>
            <p className="font-medium text-emerald-950">{result.memberStatus}</p>
          </div>
          <div>
            <p className="text-emerald-800/80">Recommended Amount</p>
            <p className="font-medium text-emerald-950">
              {result.recommendedAmount != null
                ? `GHS ${result.recommendedAmount.toFixed(2)}`
                : "—"}
            </p>
          </div>
        </div>
        <p className="text-xs text-emerald-900/80">
          Recommended amount is calculated automatically and cannot be edited.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-4">
      <p className="text-sm font-semibold text-rose-900">
        You are currently not eligible to submit this claim.
      </p>
      {result.reasons.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-rose-950">Reasons</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-rose-900">
            {result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
