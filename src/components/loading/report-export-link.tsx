"use client";

import { useState } from "react";
import { ButtonSpinner } from "@/components/loading/loading-spinner";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReportExportLinkProps {
  href: string;
  label: string;
  className?: string;
}

/** Report download link with immediate “Generating Report...” feedback. */
export function ReportExportLink({
  href,
  label,
  className,
}: ReportExportLinkProps) {
  const [generating, setGenerating] = useState(false);

  return (
    <a
      href={href}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        generating && "pointer-events-none opacity-80",
        className,
      )}
      aria-busy={generating}
      onClick={() => {
        setGenerating(true);
        window.setTimeout(() => setGenerating(false), 2500);
      }}
    >
      {generating ? (
        <>
          <ButtonSpinner />
          Generating Report...
        </>
      ) : (
        label
      )}
    </a>
  );
}
