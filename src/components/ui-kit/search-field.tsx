"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/workspace/actions";
import { TextInput } from "@/components/workspace/fields";
import { HStack, StackItem } from "@/components/workspace/layout";

type SearchFieldProps = {
  name?: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  /** Its own width from the tablet up; full width on a phone regardless. */
  width?: number;
};

/** A search box that posts through the `<Form>` around it. A visible submit
 *  action works for touch, keyboard and assistive technology alike. The URL
 *  seeds a fresh field when a search is cleared or browser history changes. */
export function SearchField(props: SearchFieldProps) {
  return <SearchFieldControl key={props.defaultValue ?? ""} {...props} />;
}

function SearchFieldControl({
  name = "q",
  label,
  placeholder,
  defaultValue = "",
  width,
}: SearchFieldProps) {
  const [value, setValue] = React.useState(defaultValue);
  return (
    <HStack gap={2} vAlign="center" width={width ? `min(100%, ${width + 96}px)` : "100%"} className="max-sm:w-full">
      <StackItem size="fill">
        <TextInput
          label={label}
          isLabelHidden
          htmlName={name}
          value={value}
          onChange={setValue}
          placeholder={placeholder}
          startIcon={Search}
          hasClear
          width="100%"
        />
      </StackItem>
      <Button type="submit" label="Search" variant="secondary" />
    </HStack>
  );
}
