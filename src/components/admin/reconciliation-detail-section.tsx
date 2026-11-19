"use client";

import { useId, useState, type ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface ReconciliationDetailSectionProps {
  /** Visible section title (include count in the string when useful). */
  title: string;
  /** Short explanation shown while collapsed and expanded. */
  description: string;
  /** Optional count for accessible labeling. */
  recordCount?: number;
  children: ReactNode;
  /** Test / analytics hook; defaults to a slug of the title. */
  sectionId?: string;
}

/**
 * Secondary reconciliation details — collapsed by default so the page
 * stays focused on confirmed financial discrepancies.
 */
export function ReconciliationDetailSection({
  title,
  description,
  recordCount,
  children,
  sectionId,
}: ReconciliationDetailSectionProps) {
  const [open, setOpen] = useState(false);
  const reactId = useId();
  const panelId = sectionId
    ? `reconciliation-detail-${sectionId}`
    : `reconciliation-detail-${reactId.replace(/:/g, "")}`;

  const toggleLabel = open ? "Hide records" : "View records";
  const countSuffix =
    typeof recordCount === "number" ? ` (${recordCount})` : "";

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      data-reconciliation-detail={sectionId ?? "section"}
      data-default-collapsed="true"
    >
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <CollapsibleTrigger
              type="button"
              className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-lg border border-black/[0.12] px-3 py-2 text-sm font-medium text-[#166534] transition-colors",
                "hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534]/40",
              )}
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={`${toggleLabel}${countSuffix}: ${title}`}
            >
              {toggleLabel}
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent id={panelId}>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
