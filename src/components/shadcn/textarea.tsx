import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-ui-md border border-ui-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-ui-muted-foreground focus-visible:border-ui-ring focus-visible:ring-[3px] focus-visible:ring-ui-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-ui-destructive aria-invalid:ring-ui-destructive/20 md:text-sm dark:bg-ui-input/30 dark:aria-invalid:ring-ui-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
