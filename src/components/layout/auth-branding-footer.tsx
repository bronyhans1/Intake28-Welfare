import {
  AUTH_POWERED_BY,
  AUTH_SYSTEM_COPYRIGHT,
} from "@/lib/branding/auth";
import { cn } from "@/lib/utils";

interface AuthBrandingFooterProps {
  className?: string;
}

/** Outside-card auth branding: copyright + powered-by only. */
export function AuthBrandingFooter({ className }: AuthBrandingFooterProps) {
  return (
    <div
      className={cn(
        "space-y-1 text-center text-xs text-muted-foreground",
        className,
      )}
    >
      <p>{AUTH_SYSTEM_COPYRIGHT}</p>
      <p>{AUTH_POWERED_BY}</p>
    </div>
  );
}
