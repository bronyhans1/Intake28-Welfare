"use client";

import { useState, useTransition } from "react";
import {
  checkMemberClaimEligibilityAction,
} from "@/actions/claim-admin";
import { EligibilityResultPanel } from "@/components/claims/eligibility-result-panel";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import type { MemberEligibilityResult } from "@/lib/claims/eligibility-engine";
import type { SerializedClaimTypeConfig } from "@/types/claims";

interface AdminClaimEligibilityCheckerProps {
  claimTypes: SerializedClaimTypeConfig[];
}

export function AdminClaimEligibilityChecker({
  claimTypes,
}: AdminClaimEligibilityCheckerProps) {
  const { showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [serviceNumber, setServiceNumber] = useState("");
  const [claimTypeCode, setClaimTypeCode] = useState(claimTypes[0]?.code ?? "");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MemberEligibilityResult | null>(null);
  const [memberLabel, setMemberLabel] = useState<string | null>(null);

  function runCheck() {
    startTransition(async () => {
      setError(null);
      setResult(null);
      setMemberLabel(null);

      const response = await checkMemberClaimEligibilityAction({
        serviceNumber,
        claimTypeCode,
      });

      if ("error" in response && response.error) {
        setError(response.error);
        showError(response.error);
        return;
      }

      if ("data" in response && response.data && "member" in response) {
        setResult(response.data);
        setMemberLabel(
          `${response.member.fullName} (${response.member.serviceNumber})`,
        );
      }
    });
  }

  return (
    <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
      <CardHeader>
        <CardTitle>Check Eligibility</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Run the same eligibility checks used by members. This does not approve
          or reject claims — it only answers whether the member may submit today.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="eligibilityServiceNumber">Service Number</Label>
            <Input
              id="eligibilityServiceNumber"
              placeholder="IS/13984"
              value={serviceNumber}
              disabled={isPending}
              onChange={(event) => setServiceNumber(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eligibilityClaimType">Claim Type</Label>
            <select
              id="eligibilityClaimType"
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={claimTypeCode}
              disabled={isPending || claimTypes.length === 0}
              onChange={(event) => setClaimTypeCode(event.target.value)}
            >
              {claimTypes.length === 0 ? (
                <option value="">No active claim types</option>
              ) : (
                claimTypes.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.displayName}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <LoadingButton
          type="button"
          loading={isPending}
          className="bg-[#166534] text-white hover:bg-[#14532d]"
          disabled={claimTypes.length === 0}
          onClick={runCheck}
        >
          Check Eligibility
        </LoadingButton>
        {result ? (
          <EligibilityResultPanel result={result} memberLabel={memberLabel} />
        ) : null}
      </CardContent>
    </Card>
  );
}
