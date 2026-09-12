"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { CircleIcon } from "lucide-react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "aspect-square size-4 shrink-0 rounded-full border border-ui-input text-ui-primary shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ui-ring focus-visible:ring-[3px] focus-visible:ring-ui-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-ui-destructive aria-invalid:ring-ui-destructive/20 dark:bg-ui-input/30 dark:aria-invalid:ring-ui-destructive/40",
        className
      )}
      {...props}
    >
      {children ?? <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center"
      >
        <CircleIcon className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-ui-primary" />
      </RadioGroupPrimitive.Indicator>}
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
