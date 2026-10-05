import * as React from "react"
import { cn } from "@/lib/utils"

// Turnfin: colour comes from data-tone (poolside.css), and there is no default role, so a
// static notice does not interrupt a screen reader. Use Notice from ui-kit, not this directly.
type AlertTone = "info" | "warning" | "error" | "success"

function Alert({
  className,
  tone = "info",
  ...props
}: React.ComponentProps<"div"> & { tone?: AlertTone }) {
  return (
    <div
      data-slot="alert"
      data-tone={tone}
      className={cn(
        "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-ui-lg px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5",
        className
      )}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm text-ui-muted-foreground [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
