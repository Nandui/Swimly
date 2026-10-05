"use client";

import * as React from "react";
import { Textarea as ShadcnTextarea } from "@/components/shadcn/textarea";
import { FieldFrame, fieldHintId } from "./field-frame";
import { useFieldFeedback } from "./form-feedback";

export type TextareaProps = Omit<
  React.ComponentProps<"textarea">,
  "value" | "defaultValue"
> & {
  label?: string;
  description?: string;
  /** Shows "Optional" in the caption under the label. */
  optional?: boolean;
  value?: string;
  defaultValue?: string | null;
};

export function Textarea({
  id: suppliedId,
  label,
  description,
  optional,
  className,
  value,
  defaultValue,
  rows = 3,
  ...props
}: TextareaProps) {
  const generatedId = React.useId(),
    id = suppliedId ?? generatedId;
  const feedback = useFieldFeedback(props.name);
  return (
    <FieldFrame
      id={id}
      label={label}
      description={description}
      optional={optional}
      className={className}
      error={feedback.error}
    >
      <ShadcnTextarea
        {...props}
        id={id}
        aria-invalid={feedback.error ? true : props["aria-invalid"]}
        onInvalid={event => { props.onInvalid?.(event); feedback.onInvalid(event); }}
        onChange={event => { feedback.clear(); props.onChange?.(event); }}
        rows={rows}
        value={value}
        defaultValue={
          value === undefined ? (defaultValue ?? undefined) : undefined
        }
        aria-label={
          props["aria-label"] ??
          (label ? undefined : (props.placeholder ?? props.name ?? "Field"))
        }
        aria-describedby={
          [props["aria-describedby"], fieldHintId(id, optional, description), feedback.error ? `${id}-error` : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
      />
    </FieldFrame>
  );
}
