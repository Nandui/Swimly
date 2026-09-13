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
      {label ? (
        <Label
          htmlFor={id}
          className="min-h-11 min-w-0 flex-1 cursor-pointer flex-col items-start justify-center gap-1"
        >
          <span>{label}</span>
          {description ? (
            <span
              id={`${id}-hint`}
              className="text-sm font-normal text-ui-muted-foreground"
            >
              {description}
            </span>
          ) : null}
        </Label>
      ) : null}
      <ShadcnSwitch
        {...props}
        id={id}
        aria-label={
          props["aria-label"] ?? (label ? undefined : (props.name ?? "Setting"))
        }
        aria-describedby={
          description ? `${id}-hint` : props["aria-describedby"]
        }
      />
    </div>
  );
}
