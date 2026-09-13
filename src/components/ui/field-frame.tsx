import type { ReactNode } from "react";
import { Label } from "@/components/shadcn/label";
import { cn } from "@/lib/utils";

/** Shared labels and hints for native-form controls composed from shadcn. */
export function FieldFrame({
  id,
  label,
  description,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      {label ? <Label htmlFor={id}>{label}{required ? <span className="text-ui-muted-foreground">(required)</span> : null}</Label> : null}
      {children}
      {description ? (
        <p id={`${id}-hint`} className="text-sm text-ui-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? <p id={`${id}-error`} className="text-sm text-ui-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
