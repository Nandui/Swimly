"use client";

import * as React from "react";
import { Selector } from "@/components/workspace/search";



export type SelectOption = { value: string; label: string; description?: string; disabled?: boolean };
export type SelectGroup = { title: string; options: SelectOption[] };

export function Select({
  id,
  name,
  label,
  description,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  required,
  disabled,
  className,
}: {
  id?: string;
  name?: string;
  /** Usually injected by the form's Field wrapper. */
  label?: string;
  description?: string;
  options: SelectOption[] | SelectGroup[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [inner, setInner] = React.useState(defaultValue ?? "");
  const controlled = value !== undefined;

  const items = options.map((option) =>
    "options" in option
      ? { type: "section" as const, title: option.title, options: option.options }
      : option
  );

  return (
    <Selector
      id={id}
      label={label ?? placeholder ?? name ?? "Choice"}
      isLabelHidden={label === undefined}
      description={description}
      options={items}
      value={controlled ? value : inner}
      onChange={(next) => {
        if (!controlled) setInner(next);
        onValueChange?.(next);
      }}
      htmlName={name}
      placeholder={placeholder}
      isRequired={required}
      isDisabled={disabled}
      width="100%"
      className={className}
    />
  );
}
