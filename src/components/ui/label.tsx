"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/** Required-field indicator — uses the destructive token; label text stays unchanged. */
function RequiredAsterisk({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("ms-0.5 text-destructive", className)}
      {...props}
    >
      *
    </span>
  )
}

type LabelProps = React.ComponentProps<"label"> & {
  /** When true, appends a red required asterisk after the label text. */
  required?: boolean
}

function Label({ className, required, children, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {required ? (
        <span>
          {children}
          <RequiredAsterisk />
        </span>
      ) : (
        children
      )}
    </label>
  )
}

export { Label, RequiredAsterisk }
export type { LabelProps }
