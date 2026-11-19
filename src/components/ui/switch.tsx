"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

function Switch({
  className,
  ...props
}: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-muted transition-colors outline-none",
        "focus-visible:ring-3 focus-visible:ring-[#166534]/25 data-checked:bg-[#166534]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-white shadow-sm transition-transform",
          "translate-x-0.5 data-checked:translate-x-[1.125rem]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
