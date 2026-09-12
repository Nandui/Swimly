import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-ui-md border border-ui-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-ui-primary selection:text-ui-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ui-foreground placeholder:text-ui-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-ui-input/30",
        "focus-visible:border-ui-ring focus-visible:ring-[3px] focus-visible:ring-ui-ring/50",
        "aria-invalid:border-ui-destructive aria-invalid:ring-ui-destructive/20 dark:aria-invalid:ring-ui-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
