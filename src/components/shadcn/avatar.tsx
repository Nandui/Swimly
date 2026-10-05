"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar as AvatarPrimitive } from "radix-ui"
import { nameInitials } from "@/lib/format"

/** Up to two initials from a person's name, for an avatar fallback: the one server-safe helper
 *  in lib/format.ts, re-exported so client callers keep importing it with the Avatar. */
const initials = nameInitials

/** The Poolside Clear v2 avatar: "default" 32px (bars), "lg" 40px (rows),
 *  "xl" 64px (profile). `self` marks the signed-in person's own avatar with
 *  the soft primary tint; every other avatar is neutral. */
function Avatar({
  className,
  size = "default",
  self = false,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: "default" | "lg" | "xl"
  self?: boolean
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      data-self={self ? "" : undefined}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=xl]:size-16",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-ui-muted text-ui-foreground text-xs font-semibold shadow-[inset_0_0_0_1px_var(--ui-border)] group-data-[size=xl]/avatar:text-lg group-data-[self]/avatar:bg-ui-brand-soft group-data-[self]/avatar:text-ui-brand-ink group-data-[self]/avatar:shadow-none",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback, initials }
