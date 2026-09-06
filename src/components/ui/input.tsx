"use client";

import * as React from "react";
import { DateInput } from "@astryxdesign/core/DateInput";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TimeInput } from "@astryxdesign/core/TimeInput";

/** Astryx types its date and time values as branded strings. A form field
 *  holds whatever was posted or typed, so it is handed over as-is. */
type IsoDate = React.ComponentProps<typeof DateInput>["value"];
type IsoTime = React.ComponentProps<typeof TimeInput>["value"];

/** A field that still works inside a plain `<form>`: give it a `name` and a
 *  `defaultValue` and it posts through FormData like the native input it
 *  replaces. Astryx's inputs are controlled, so the value lives here.
 *
 *  Text, email and password are Astryx's TextInput; a date, a time and a
 *  number are its DateInput, TimeInput and NumberInput. The date and time
 *  inputs carry no form name of their own, so a hidden input posts what
 *  they hold. */

export type InputProps = Omit<
  React.ComponentProps<"input">,
  "size" | "value" | "defaultValue" | "onChange" | "type"
> & {
  type?: "text" | "email" | "password" | "date" | "time" | "number";
  /** The field's label. Usually injected by the form's Field wrapper. */
  label?: string;
  description?: string;
  value?: string;
  defaultValue?: string | number | null;
  onChange?: (value: string) => void;
};

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
  min,
  max,
  step,
  className,
  ref,
  ...rest
}: InputProps) {
  const [inner, setInner] = React.useState(defaultValue == null ? "" : String(defaultValue));
  const inputRef = React.useRef<HTMLInputElement>(null);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const ariaLabel = rest["aria-label"];
  const text = label ?? ariaLabel ?? placeholder ?? name ?? "Field";
  const shared = {
    id,
    label: text,
    isLabelHidden: label === undefined,
    description,
    isRequired: required,
    isDisabled: disabled,
    width: "100%" as const,
    className,
  };
  const set = (next: string) => {
    if (!controlled) setInner(next);
    onChange?.(next);
  };

  React.useImperativeHandle(ref, () => inputRef.current!);
  // A native form.reset() must also clear this controlled adapter's state;
  // otherwise the password form's cleared values reappear on the next render.
  React.useEffect(() => {
    const form = inputRef.current?.form;
    if (controlled || !form) return;
    const reset = () => setInner(defaultValue == null ? "" : String(defaultValue));
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [controlled, defaultValue, rest.form, type]);

  if (type === "date") {
    return (
      <>
        <input type="hidden" name={name} value={current} disabled={disabled} form={rest.form} />
        <DateInput
          {...shared}
          ref={inputRef}
          value={(current || undefined) as IsoDate}
          onChange={(next) => set(next ?? "")}
          min={(typeof min === "string" ? min : undefined) as IsoDate}
          max={(typeof max === "string" ? max : undefined) as IsoDate}
          hasClear={!required}
        />
      </>
    );
  }

  if (type === "time") {
    return (
      <>
        <input type="hidden" name={name} value={current} disabled={disabled} form={rest.form} />
        <TimeInput
          {...shared}
          ref={inputRef}
          value={(current || undefined) as IsoTime}
          onChange={(next) => set(next ?? "")}
          min={(typeof min === "string" ? min : undefined) as IsoTime}
          max={(typeof max === "string" ? max : undefined) as IsoTime}
          hasAutoFocus={autoFocus}
          hourFormat="24h"
          hasClear={!required}
        />
      </>
    );
  }

  if (type === "number") {
    return (
      <NumberInput
        {...rest}
        {...shared}
        {...{ required }}
        ref={inputRef}
        htmlName={name}
        value={current === "" ? null : Number(current)}
        onChange={(next) => set(next === null || Number.isNaN(next) ? "" : String(next))}
        min={min === undefined ? undefined : Number(min)}
        max={max === undefined ? undefined : Number(max)}
        step={step === undefined ? undefined : Number(step)}
        placeholder={placeholder}
        isReadOnly={readOnly}
        hasAutoFocus={autoFocus}
        isWheelEnabled={false}
      />
    );
  }

  return (
    <TextInput
      {...rest}
      {...shared}
      {...{ required }}
      ref={inputRef}
      type={type}
      value={current}
      onChange={set}
      htmlName={name}
      placeholder={placeholder}
      isReadOnly={readOnly}
      hasAutoFocus={autoFocus}
    />
  );
}
