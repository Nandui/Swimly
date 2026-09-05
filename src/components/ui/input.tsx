"use client";

import * as React from "react";
import { Field } from "@astryxdesign/core/Field";
import { TextInput } from "@astryxdesign/core/TextInput";
import { cn } from "@/lib/utils";

/** A text field, on Astryx's TextInput, that still works inside a plain
 *  `<form>`: give it a `name` and a `defaultValue` and it posts through
 *  FormData like the native input it replaces. Astryx's input is controlled,
 *  so the value lives here.
 *
 *  Astryx draws text, email and password. A date, a time or a number keeps
 *  the native control — the browser's picker is the right one on a phone —
 *  inside Astryx's Field so the label and spacing match. */

export type InputProps = Omit<React.ComponentProps<"input">, "size" | "value" | "defaultValue"> & {
  /** The field's label. Usually injected by the form's Field wrapper. */
  label?: string;
  description?: string;
  value?: string;
  defaultValue?: string | number | null;
};

const ASTRYX_TYPES = new Set(["text", "email", "password"]);

export function Input({
  type = "text",
  id,
  name,
  label,
  description,
  value,
  defaultValue,
  onChange,
  placeholder,
  required,
  disabled,
  readOnly,
  autoFocus,
  className,
  ...rest
}: InputProps) {
  const [inner, setInner] = React.useState(defaultValue == null ? "" : String(defaultValue));
  const generatedId = React.useId();
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const ariaLabel = (rest as { "aria-label"?: string })["aria-label"];
  const text = label ?? ariaLabel ?? placeholder ?? name ?? "Field";

  if (ASTRYX_TYPES.has(type)) {
    return (
      <TextInput
        type={type as "text" | "email" | "password"}
        label={text}
        isLabelHidden={label === undefined}
        description={description}
        value={current}
        onChange={(next, event) => {
          if (!controlled) setInner(next);
          onChange?.(event);
        }}
        htmlName={name}
        placeholder={placeholder}
        isRequired={required}
        isDisabled={disabled}
        isReadOnly={readOnly}
        hasAutoFocus={autoFocus}
        width="100%"
        className={className}
        id={id}
      />
    );
  }

  const inputId = id ?? name ?? generatedId;
  return (
    <Field
      label={text}
      inputID={inputId}
      isLabelHidden={label === undefined}
      description={description}
      isRequired={required}
      isDisabled={disabled}
      width="100%"
    >
      <input
        {...rest}
        id={inputId}
        name={name}
        type={type}
        value={controlled ? value : undefined}
        defaultValue={controlled ? undefined : (defaultValue ?? undefined)}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        autoFocus={autoFocus}
        className={cn(
          "h-(--size-element-md) w-full min-w-0 rounded-md border border-border-strong bg-surface px-2.5 text-sm text-primary",
          "placeholder:text-disabled disabled:opacity-60",
          "outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-bg",
          className
        )}
      />
    </Field>
  );
}
