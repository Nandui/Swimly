"use client";

import * as React from "react";
import { Input as ShadcnInput } from "@/components/shadcn/input";
import { FieldFrame } from "./field-frame";
import { useFieldFeedback } from "./form-feedback";

export type InputProps = Omit<
  React.ComponentProps<"input">,
  "size" | "value" | "defaultValue" | "onChange"
> & {
  label?: string;
  description?: string;
  value?: string;
  defaultValue?: string | number | null;
  onChange?: (value: string) => void;
};

/** Native date/time/number semantics, including required, bounds and form.reset(). */
export function Input({
  id: suppliedId,
  label,
  description,
  className,
  value,
  defaultValue,
  onChange,
  ...props
}: InputProps) {
  const generatedId = React.useId();
  const id = suppliedId ?? generatedId;
  const feedback = useFieldFeedback(props.name);
  return (
    <FieldFrame
      id={id}
      label={label}
      description={description}
      className={className}
      error={feedback.error}
      required={props.required}
    >
      <ShadcnInput
        {...props}
        id={id}
        aria-invalid={feedback.error ? true : props["aria-invalid"]}
        onInvalid={event => { props.onInvalid?.(event); feedback.onInvalid(event); }}
        value={value}
        defaultValue={
          value === undefined ? (defaultValue ?? undefined) : undefined
        }
        aria-label={
          props["aria-label"] ??
          (label ? undefined : (props.placeholder ?? props.name ?? "Field"))
        }
        aria-describedby={
          [props["aria-describedby"], description ? `${id}-hint` : null, feedback.error ? `${id}-error` : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onChange={(event) => { feedback.clear(); onChange?.(event.target.value); }}
      />
    </FieldFrame>
  );
}
