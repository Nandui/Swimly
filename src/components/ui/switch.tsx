"use client";

import * as React from "react";
import { Switch as AstryxSwitch } from "@astryxdesign/core/Switch";

/** An on/off setting on Astryx's Switch. With a `name` it posts "on" through
 *  FormData when on, and nothing when off — the same as the native checkbox
 *  and the switch it replaces, so the actions reading it did not change. */
export function Switch({
  id,
  name,
  label,
  description,
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  className,
  labelSpacing,
  ...rest
}: {
  /** "spread" pushes the switch to the far end of the row, the setting-row
   *  shape; "hug" keeps it beside the label. */
  labelSpacing?: "hug" | "spread";
  id?: string;
  name?: string;
  /** Usually injected by the form's Field wrapper, or the row's own label. */
  label?: string;
  description?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const [inner, setInner] = React.useState(defaultChecked);
  const controlled = checked !== undefined;
  const text = label ?? rest["aria-label"] ?? name ?? "Setting";

  return (
    <AstryxSwitch
      id={id}
      label={text}
      isLabelHidden={label === undefined}
      description={description}
      value={controlled ? checked : inner}
      onChange={(next) => {
        if (!controlled) setInner(next);
        onCheckedChange?.(next);
      }}
      htmlName={name}
      isDisabled={disabled}
      labelSpacing={labelSpacing}
      width={labelSpacing === "spread" ? "100%" : undefined}
      className={className}
      aria-labelledby={rest["aria-labelledby"]}
    />
  );
}
