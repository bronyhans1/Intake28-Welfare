"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const GIS_LOGO_PATH = "/images/gis-logo.png";

const sizeMap = {
  header: {
    className: "h-[4.5rem] w-[4.5rem] sm:h-[5.5rem] sm:w-[5.5rem]",
    iconClassName: "size-10 sm:size-12",
  },
  watermark: {
    className: "h-44 w-44 sm:h-48 sm:w-48",
    iconClassName: "size-24 sm:size-28",
  },
} as const;

interface GisLogoProps {
  size?: keyof typeof sizeMap;
  className?: string;
  priority?: boolean;
}

function LogoFallback({
  size,
  className,
}: {
  size: keyof typeof sizeMap;
  className?: string;
}) {
  const dimensions = sizeMap[size];
  return (
    <div
      role="img"
      aria-label="Ghana Immigration Service"
      className={cn(
        "flex items-center justify-center rounded-full bg-[#166534]/10",
        dimensions.className,
        className,
      )}
    >
      <Shield className={cn("text-[#166534]", dimensions.iconClassName)} />
    </div>
  );
}

export function GisLogo({
  size = "header",
  className,
}: GisLogoProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const dimensions = sizeMap[size];

  if (imageFailed) {
    return <LogoFallback size={size} className={className} />;
  }

  return (
    // Native img avoids Next.js Image optimizer errors when the asset is missing
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={GIS_LOGO_PATH}
      alt="Ghana Immigration Service"
      className={cn("object-contain", dimensions.className, className)}
      onError={() => setImageFailed(true)}
    />
  );
}
