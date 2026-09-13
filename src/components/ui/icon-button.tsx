"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/shadcn/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn/tooltip";

/** The accessible name remains available when touch users cannot hover. */
export function IconButton({ label, description, children, size = "icon", variant = "ghost", ...props }: Omit<ComponentProps<typeof Button>, "asChild" | "aria-label" | "title"> & { label: string; description?: string }) {
  return <Tooltip><TooltipTrigger asChild><Button {...props} size={size} variant={variant} aria-label={label}>{children}</Button></TooltipTrigger><TooltipContent>{description ?? label}</TooltipContent></Tooltip>;
}
