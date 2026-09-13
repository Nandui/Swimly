import type { ReactNode } from "react";
import { Label } from "@/components/shadcn/label";
import { cn } from "@/lib/utils";

/** Shared labels and hints for native-form controls composed from shadcn. */
export function FieldFrame({
  id,
  label,
  description,
  className,
  children,
}: {
  id: string;
  label?: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      {children}
      {description ? (
        <p id={`${id}-hint`} className="text-sm text-ui-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
