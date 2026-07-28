"use client";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/loading/loading-spinner";
import { cn } from "@/lib/utils";

type LoadingButtonProps = React.ComponentProps<typeof Button> & {
  loading?: boolean;
  loadingText?: string;
};

export function LoadingButton({
  loading = false,
  loadingText,
  disabled,
  children,
  className,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading}
      className={cn(className)}
    >
      {loading ? (
        <>
          <ButtonSpinner />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
