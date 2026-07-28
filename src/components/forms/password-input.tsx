"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toTruthyDataAttribute } from "@/lib/utils/dom-attribute";
import { cn } from "@/lib/utils";

interface PasswordInputProps extends React.ComponentProps<typeof Input> {
  id: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { id, className, disabled, "aria-invalid": ariaInvalid, ...props },
    ref,
  ) {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          id={id}
          type={visible ? "text" : "password"}
          disabled={disabled}
          aria-invalid={toTruthyDataAttribute(ariaInvalid)}
          className={cn(
            "pr-10",
            "[&::-ms-reveal]:hidden [&::-ms-clear]:hidden",
            "[&::-webkit-credentials-auto-fill-button]:hidden",
            "[&::-webkit-strong-password-auto-fill-button]:hidden",
            className,
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setVisible((value) => !value)}
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible ? true : undefined}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
    );
  },
);
