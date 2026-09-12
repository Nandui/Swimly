import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ui-ring focus-visible:ring-[3px] focus-visible:ring-ui-ring/50 aria-invalid:border-ui-destructive aria-invalid:ring-ui-destructive/20 dark:aria-invalid:ring-ui-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-ui-primary text-ui-primary-foreground [a&]:hover:bg-ui-primary/90",
        secondary:
          "bg-ui-secondary text-ui-secondary-foreground [a&]:hover:bg-ui-secondary/90",
        destructive:
          "bg-ui-destructive text-white focus-visible:ring-ui-destructive/20 dark:bg-ui-destructive/60 dark:focus-visible:ring-ui-destructive/40 [a&]:hover:bg-ui-destructive/90",
        outline:
          "border-ui-border text-ui-foreground [a&]:hover:bg-ui-accent [a&]:hover:text-ui-accent-foreground",
        ghost: "[a&]:hover:bg-ui-accent [a&]:hover:text-ui-accent-foreground",
        link: "text-ui-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
