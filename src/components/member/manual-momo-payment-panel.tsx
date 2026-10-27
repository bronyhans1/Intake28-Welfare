"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  MANUAL_MOMO_ACCOUNT,
  MANUAL_MOMO_INSTRUCTIONS,
  MANUAL_MOMO_SECTION_TITLE,
} from "@/lib/payments/manual-momo";
import { cn } from "@/lib/utils";

interface ManualMomoPaymentPanelProps {
  serviceNumber?: string | null;
}

export function ManualMomoPaymentPanel({
  serviceNumber,
}: ManualMomoPaymentPanelProps) {
  const [copiedField, setCopiedField] = useState<"number" | "service" | null>(
    null,
  );

  async function copyValue(
    value: string,
    field: "number" | "service",
  ): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setCopiedField(null);
    }
  }

  return (
    <section className="rounded-xl border border-[#166534]/20 bg-[#166534]/[0.03] p-4 sm:p-5">
      <h3 className="text-base font-semibold text-foreground sm:text-lg">
        {MANUAL_MOMO_SECTION_TITLE}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Online checkout is temporarily unavailable. Pay via Mobile Money using
        the details below.
      </p>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">Network</dt>
          <dd className="font-medium text-foreground">
            {MANUAL_MOMO_ACCOUNT.network}
          </dd>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <dt className="text-muted-foreground">MoMo Number</dt>
          <dd className="flex items-center gap-2">
            <span className="font-semibold tracking-wide text-foreground">
              {MANUAL_MOMO_ACCOUNT.number}
            </span>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-8 gap-1.5",
              )}
              onClick={() => copyValue(MANUAL_MOMO_ACCOUNT.number, "number")}
            >
              {copiedField === "number" ? (
                <>
                  <Check className="size-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  Copy
                </>
              )}
            </button>
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">Registered Account Name</dt>
          <dd className="text-right font-medium text-foreground">
            {MANUAL_MOMO_ACCOUNT.accountName}
          </dd>
        </div>
        {serviceNumber ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] pt-3">
            <dt className="text-muted-foreground">Your payment reference</dt>
            <dd className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                {serviceNumber}
              </span>
              <button
                type="button"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-8 gap-1.5",
                )}
                onClick={() => copyValue(serviceNumber, "service")}
              >
                {copiedField === "service" ? (
                  <>
                    <Check className="size-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    Copy
                  </>
                )}
              </button>
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        {MANUAL_MOMO_INSTRUCTIONS}
      </p>
    </section>
  );
}
