"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar as AvatarPrimitive } from "radix-ui"

/** Up to two initials from a person's name, for an avatar fallback. The UI kit may not import
 *  the platform, so this mirrors `nameInitials` in lib/format.ts, which server pages use. */
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("")
}

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
        "flex size-full items-center justify-center rounded-full bg-ui-muted text-ui-foreground text-xs font-semibold inset-ring inset-ring-ui-border group-data-[size=xl]/avatar:text-lg group-data-[self]/avatar:bg-ui-brand-soft group-data-[self]/avatar:text-ui-brand-ink group-data-[self]/avatar:inset-ring-0",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback, initials }
