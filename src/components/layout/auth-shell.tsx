import Link from "next/link";
import { GisLogo } from "@/components/brand/gis-logo";
import { AuthBrandingFooter } from "@/components/layout/auth-branding-footer";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

interface AuthShellProps {
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Executive presentation styling: logo, gradient, watermark */
  executive?: boolean;
}

const executiveBackgroundStyle = {
  background:
    "linear-gradient(180deg, rgba(19,185,108,0.05) 0%, #ffffff 48%, #f8fafc 100%)",
} as const;

export function AuthShell({
  children,
  footer,
  className,
  executive = false,
}: AuthShellProps) {
  return (
    <main
      className={cn(
        "relative isolate flex min-h-screen flex-col items-center justify-center px-4 py-7 sm:py-9",
        !executive && "bg-muted/30",
        className,
      )}
      style={executive ? executiveBackgroundStyle : undefined}
    >
      <header className="relative z-10 mb-3 max-w-md text-center">
        {executive ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <GisLogo
              size="watermark"
              className="opacity-[0.025] select-none sm:opacity-[0.03]"
            />
          </div>
        ) : null}

        <div className="relative z-10">
          {executive ? (
            <GisLogo size="header" className="mx-auto mb-1.5" priority />
          ) : null}
          <p className="text-base font-bold tracking-[0.25em] text-[#14532d] uppercase sm:text-lg">
            {siteConfig.organization}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {siteConfig.portalTitle}
          </h1>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">
            {siteConfig.tagline}
          </p>
        </div>
      </header>

      <div className="relative z-10 w-full max-w-md">{children}</div>

      <div className="relative z-10 mt-5 w-full max-w-md space-y-5">
        {footer !== undefined ? (
          footer
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Already activated?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        )}
        <AuthBrandingFooter />
      </div>
    </main>
  );
}

export function AuthCardHeader({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("text-center", className)}>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
