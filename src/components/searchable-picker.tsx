"use client";

import * as React from "react";
import { Selector } from "@/components/workspace/search";

export type PickerOption = {
  value: string;
  label: string;
  /** Second line — an age, a level, a time. What tells two Ava Byrnes apart. */
  hint?: string;
  /** A count, or places left. Joins the hint on the second line. */
  meta?: string;
  disabled?: boolean;
};


export function SearchablePicker({
  name,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  defaultValue = "",
  id,
  label,
  description,
}: {
  name: string;
  options: PickerOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  defaultValue?: string;
  id?: string;
  /** Usually injected by the form's Field wrapper. */
  label?: string;
  description?: string;
}) {
  const [value, setValue] = React.useState(defaultValue);

  return (
    <Selector
      id={id}
      label={label ?? placeholder}
      isLabelHidden={label === undefined}
      description={description}
      options={options.map((option) => ({
        value: option.value,
        label: option.label,
        description: [option.hint, option.meta].filter(Boolean).join(" · ") || undefined,
        disabled: option.disabled,
      }))}
      value={value}
      onChange={setValue}
      htmlName={name}
      placeholder={placeholder}
      hasSearch
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      emptySearchText={emptyText}
      width="100%"
    />
  );
}
