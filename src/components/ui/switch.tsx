"use client";

import * as React from "react";
import { Switch as ShadcnSwitch } from "@/components/shadcn/switch";
import { Label } from "@/components/shadcn/label";
import { cn } from "@/lib/utils";

export function Switch({
  id: suppliedId,
  label,
  description,
  labelSpacing,
  className,
  ...props
}: React.ComponentProps<typeof ShadcnSwitch> & {
  label?: string;
  description?: string;
  labelSpacing?: "hug" | "spread";
}) {
  const generatedId = React.useId(),
    id = suppliedId ?? generatedId;
  return (
    <div
      className={cn(
        "flex min-h-11 items-center gap-3",
        labelSpacing === "spread" && "justify-between",
        className,
      )}
    >
      {label || description ? (
        <div className="flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-1">
          {label ? (
            <Label htmlFor={id} className="cursor-pointer">
              {label}
            </Label>
          ) : null}
          {description ? (
            <p
              id={`${id}-hint`}
              data-slot="field-description"
              className="text-xs font-normal text-ui-muted-foreground"
            >
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      {/* The name comes from `label` (or an explicit aria-label, or an outside htmlFor
          label), never from the form field name. */}
      <ShadcnSwitch
        {...props}
        id={id}
        aria-describedby={
          [props["aria-describedby"], description ? `${id}-hint` : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
      />
    </div>
  );
}
