"use client";

import { useState } from "react";
import { Download, Eye, Scale } from "lucide-react";
import { LoadingButton } from "@/components/ui/loading-button";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatLongDisplayDate } from "@/lib/utils/format-date";
import { cn } from "@/lib/utils";
import type { SerializedConstitutionVersion } from "@/types/claims";

interface MemberOfficialConstitutionCardProps {
  constitution: SerializedConstitutionVersion | null;
}

function guessFileName(url: string, versionNumber: string): string {
  try {
    const path = decodeURIComponent(url.split("?")[0] ?? "");
    const leaf = path.split("/").pop() ?? "";
    if (leaf && /\.(pdf|docx?)$/i.test(leaf)) return leaf;
  } catch {
    // Fall through to default name.
  }
  return `Welfare-Constitution-${versionNumber || "official"}.pdf`;
}

export function MemberOfficialConstitutionCard({
  constitution,
}: MemberOfficialConstitutionCardProps) {
  const [downloading, setDownloading] = useState(false);
  const documentUrl = constitution?.documentRef?.trim() || null;

  async function handleDownload() {
    if (!documentUrl || downloading) return;

    const fileName = guessFileName(
      documentUrl,
      constitution?.versionNumber ?? "official",
    );

    setDownloading(true);
    try {
      const response = await fetch(documentUrl);
      if (!response.ok) {
        throw new Error("Failed to download the constitution document.");
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch {
      // Cross-origin storage may block fetch; fall back to direct navigation.
      const link = document.createElement("a");
      link.href = documentUrl;
      link.download = fileName;
      link.target = "_blank";
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#166534]/10 text-[#166534]">
            <Scale className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-xl">Official Welfare Constitution</CardTitle>
            <CardDescription>
              The governing document for the GIS Intake 28 Welfare Scheme.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!constitution ? (
          <p className="rounded-xl border border-dashed border-black/[0.1] bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            No official constitution has been published yet.
          </p>
        ) : (
          <>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Constitution Title
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {constitution.displayName}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Version
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {constitution.versionNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Effective Date
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {formatLongDisplayDate(constitution.effectiveFrom)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Status
                </dt>
                <dd className="mt-1">
                  <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                    Official Constitution
                  </span>
                </dd>
              </div>
            </dl>

            <div className="rounded-xl border border-[#166534]/15 bg-[#166534]/[0.03] px-4 py-4 sm:px-5">
              <p className="text-sm font-medium text-foreground">
                This document governs the Welfare Scheme including:
              </p>
              <ul className="mt-3 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
                <li>• Membership</li>
                <li>• Contributions</li>
                <li>• Welfare Benefits</li>
                <li>• Claims</li>
                <li>• Member Responsibilities</li>
                <li>• Executive Administration</li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                All members are encouraged to read and understand the current
                constitution before participating in the Welfare Scheme.
              </p>
            </div>

            {documentUrl ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ size: "default" }),
                    "bg-[#166534] text-white hover:bg-[#14532d]",
                  )}
                >
                  <Eye className="size-4" />
                  View Constitution
                </a>
                <LoadingButton
                  type="button"
                  variant="outline"
                  loading={downloading}
                  loadingText="Downloading..."
                  className="border-sky-200 text-sky-800 hover:bg-sky-50"
                  onClick={handleDownload}
                >
                  <Download className="size-4" />
                  Download Constitution
                </LoadingButton>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
