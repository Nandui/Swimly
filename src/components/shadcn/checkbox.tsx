"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-ui-input shadow-xs transition-shadow outline-none focus-visible:border-ui-ring focus-visible:ring-[3px] focus-visible:ring-ui-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-ui-destructive aria-invalid:ring-ui-destructive/20 data-[state=checked]:border-ui-primary data-[state=checked]:bg-ui-primary data-[state=checked]:text-ui-primary-foreground dark:bg-ui-input/30 dark:aria-invalid:ring-ui-destructive/40 dark:data-[state=checked]:bg-ui-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
