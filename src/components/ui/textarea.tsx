"use client";

import * as React from "react";
import { TextArea } from "@astryxdesign/core/TextArea";

/** A multi-line field on Astryx's TextArea, posting through FormData like the
 *  native one it replaces. See `Input` for the shape. */
export type TextareaProps = Omit<React.ComponentProps<"textarea">, "value" | "defaultValue"> & {
  label?: string;
  description?: string;
  value?: string;
  defaultValue?: string | null;
};

export function Textarea({
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
  rows = 3,
  maxLength,
  autoFocus,
  className,
  ...rest
}: TextareaProps) {
  const [inner, setInner] = React.useState(defaultValue ?? "");
  const controlled = value !== undefined;
  const ariaLabel = rest["aria-label"];
  const text = label ?? ariaLabel ?? placeholder ?? name ?? "Field";

  return (
    <TextArea
      {...rest}
      {...{ required }}
      label={text}
      isLabelHidden={label === undefined}
      description={description}
      value={controlled ? value : inner}
      onChange={(next, event) => {
        if (!controlled) setInner(next);
        onChange?.(event);
      }}
      htmlName={name}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
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
