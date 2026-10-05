import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 text-sm font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity,translate] ui-motion-feedback ui-motion-press enabled:active:opacity-90 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-ui-primary text-ui-primary-foreground hover:bg-ui-primary-hover",
        destructive: "bg-ui-destructive",
        outline:
          "border bg-ui-background shadow-xs hover:bg-ui-accent hover:text-ui-accent-foreground dark:border-ui-input dark:bg-ui-input/30 dark:hover:bg-ui-input/50",
        ghost:
          "hover:bg-ui-accent hover:text-ui-accent-foreground dark:hover:bg-ui-accent/50",
        link: "text-ui-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
