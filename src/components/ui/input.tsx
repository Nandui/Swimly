"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input as ShadcnInput } from "@/components/shadcn/input";
import { cn } from "@/lib/utils";
import { FieldFrame, fieldHintId } from "./field-frame";
import { useFieldFeedback } from "./form-feedback";

export type InputProps = Omit<
  React.ComponentProps<"input">,
  "size" | "value" | "defaultValue" | "onChange"
> & {
  label?: string;
  description?: string;
  /** Shows "Optional" in the caption under the label. */
  optional?: boolean;
  value?: string;
  defaultValue?: string | number | null;
  onChange?: (value: string) => void;
};

/** Native date/time/number semantics, including required, bounds and form.reset().
 *
 *  A password field carries a Show password button at its end, so people can check what
 *  they typed. A PIN (`inputMode="numeric"`) does not: it is entered on shared work devices
 *  with people standing by. */
export function Input({
  id: suppliedId,
  label,
  description,
  optional,
  className,
  value,
  defaultValue,
  onChange,
  ...props
}: InputProps) {
  const generatedId = React.useId();
  const id = suppliedId ?? generatedId;
  const feedback = useFieldFeedback(props.name);
  const [shown, setShown] = React.useState(false);
  const canShow = props.type === "password" && props.inputMode !== "numeric";
  const field = (
      <ShadcnInput
        {...props}
        type={canShow && shown ? "text" : props.type}
        className={cn(canShow && "pr-12")}
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
          [props["aria-describedby"], fieldHintId(id, optional, description), feedback.error ? `${id}-error` : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onChange={(event) => { feedback.clear(); onChange?.(event.target.value); }}
      />
  );
  return (
    <FieldFrame
      id={id}
      label={label}
      description={description}
      optional={optional}
      className={className}
      error={feedback.error}
    >
      {canShow ? (
        <div className="relative min-w-0">
          {field}
          <div className="absolute inset-y-0 right-1 flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              // One name with a pressed state: a name that also flipped would say it twice.
              aria-label="Show password"
              aria-pressed={shown}
              aria-controls={id}
              disabled={props.disabled}
              onClick={() => setShown((now) => !now)}
            >
              {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
        </div>
      ) : field}
    </FieldFrame>
  );
}
