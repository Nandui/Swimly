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
  // With children the item is a labelled segment (SegmentedChoice, .pc-seg-item): it keeps
  // none of the dot's geometry or decoration, so nothing leaks past the segment styles.
  const dot = children === undefined || children === null
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "shrink-0 transition-[color,background-color,border-color,box-shadow] ui-motion-feedback outline-none disabled:cursor-not-allowed disabled:opacity-50",
        dot && "aspect-square size-5 rounded-full border border-ui-input text-ui-primary focus-visible:border-ui-ring focus-visible:ring-3 focus-visible:ring-ui-ring/50 aria-invalid:border-ui-destructive aria-invalid:ring-ui-destructive/20 dark:bg-ui-input/30 dark:aria-invalid:ring-ui-destructive/40",
        className
      )}
      {...props}
    >
      {dot ? <RadioGroupPrimitive.Indicator
        forceMount
        data-slot="radio-group-indicator"
        data-motion="selection"
        aria-hidden="true"
        className="relative flex items-center justify-center"
      >
        <CircleIcon className="absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 fill-ui-primary" />
      </RadioGroupPrimitive.Indicator> : children}
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
