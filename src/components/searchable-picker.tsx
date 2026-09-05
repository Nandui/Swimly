"use client";

import * as React from "react";
import { Selector } from "@astryxdesign/core/Selector";

export type PickerOption = {
  value: string;
  label: string;
  /** Second line — an age, a level, a time. What tells two Ava Byrnes apart. */
  hint?: string;
  /** A count, or places left. Joins the hint on the second line. */
  meta?: string;
  disabled?: boolean;
};

/** The Collapse-Not-Scroll rule applied to a field: anything that grows without
 *  limit — every class, every level — goes behind a search rather than into a
 *  select that gets longer every term. Astryx's Selector with search is that.
 *
 *  It posts through a hidden input, so it works inside the same plain `<form>`
 *  as every other field. */
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
      emptySearchText={emptyText}
      width="100%"
    />
  );
}
