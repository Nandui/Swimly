"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";

/** A search box that posts through the `<Form>` around it. Enter submits;
 *  the hidden submit button is there because implicit submission has enough
 *  edge cases that a search box should not be the thing betting on it, and
 *  it gives keyboard users something to tab to. */
export function SearchField({
  name = "q",
  label,
  placeholder,
  defaultValue = "",
  width,
}: {
  name?: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  /** Its own width from the tablet up; full width on a phone regardless. */
  width?: number;
}) {
  const [value, setValue] = React.useState(defaultValue);
  return (
    <>
      <TextInput
        label={label}
        isLabelHidden
        htmlName={name}
        value={value}
        onChange={setValue}
        placeholder={placeholder}
        startIcon={Search}
        hasClear
        width={width ? `min(100%, ${width}px)` : "100%"}
      />
      <VisuallyHidden>
        <Button type="submit" label="Search" variant="ghost" size="sm" />
      </VisuallyHidden>
    </>
  );
}
