"use client";

import Image from "next/image";
import { useState } from "react";
import { PORTAL_LOGO_PATH } from "@/lib/branding/assets";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

interface PortalBrandingProps {
  subtitle: string;
  className?: string;
}

export function PortalBranding({ subtitle, className }: PortalBrandingProps) {
  const [logoVisible, setLogoVisible] = useState(true);

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {logoVisible ? (
        <Image
          src={PORTAL_LOGO_PATH}
          alt="GIS Intake 28 Welfare logo"
          width={48}
          height={48}
          className="size-12 shrink-0 object-contain"
          onError={() => setLogoVisible(false)}
          priority
        />
      ) : null}
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold tracking-wide text-[#166534] uppercase">
          {siteConfig.organization}
        </p>
        <p className="truncate text-sm font-semibold text-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
