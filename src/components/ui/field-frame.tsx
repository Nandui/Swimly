import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/shadcn/label";
import { cn } from "@/lib/utils";

/** The id of a field's caption when it has one ("Optional" and/or the hint), for aria-describedby. */
export function fieldHintId(id: string, optional?: boolean, description?: string) {
  return optional || description ? `${id}-hint` : undefined;
}

/** Shared labels and hints for native-form controls composed from shadcn (Poolside Clear v2):
 *  the label (600), a caption with "Optional" and/or the hint, the control, then the error in
 *  the danger colour with an icon. Required fields carry no marker; native `required` stays. */
export function FieldFrame({
  id,
  label,
  description,
  optional,
  error,
  className,
  children,
}: {
  id: string;
  label?: string;
  description?: string;
  /** Marks the field "Optional" in its caption. Required fields are the default and unmarked. */
  optional?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      {label ? <Label id={`${id}-label`} htmlFor={id} className="block">{label}</Label> : null}
      {optional || description ? (
        <p id={`${id}-hint`} data-slot="field-description" className="text-xs font-normal text-ui-muted-foreground">
          {optional ? "Optional" : null}
          {optional && description ? ". " : null}
          {description}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-ui-destructive" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0">{error}</span>
        </p>
      ) : null}
    </div>
  );
}
