"use client";

import * as React from "react";
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectGroup as Group,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { FieldFrame, fieldHintId } from "./field-frame";
import { useFieldFeedback } from "./form-feedback";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};
/** `id` is a stable key (a record id): two groups may share a title. */
export type SelectGroup = { id: string; title: string; options: SelectOption[] };
// Radix reserves an empty value for the placeholder. Empty options still post "".
const EMPTY = "__swimly_empty_option__";

export function Select({
  id: suppliedId,
  name,
  label,
  description,
  optional,
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
  label?: string;
  description?: string;
  /** Shows "Optional" in the caption under the label. */
  optional?: boolean;
  options: SelectOption[] | SelectGroup[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const generatedId = React.useId(),
    id = suppliedId ?? generatedId;
  const [inner, setInner] = React.useState(defaultValue ?? "");
  const [invalid, setInvalid] = React.useState(false);
  const feedback = useFieldFeedback(name);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const controlled = value !== undefined,
    current = controlled ? value : inner;
  const input = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const form = input.current?.form;
    if (!form || controlled) return;
    const reset = () => {
      setInner(defaultValue ?? "");
      setInvalid(false);
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [controlled, defaultValue]);
  const emptyOption = options.some((option) =>
    "options" in option
      ? option.options.some((item) => item.value === "")
      : option.value === "",
  );
  const item = (option: SelectOption) => (
    <SelectItem
      key={option.value}
      value={option.value || EMPTY}
      disabled={option.disabled}
    >
      {option.label}
      {option.description ? (
        <span className="block text-xs text-ui-muted-foreground">
          {option.description}
        </span>
      ) : null}
    </SelectItem>
  );
  return (
    <FieldFrame
      id={id}
      label={label}
      description={description}
      optional={optional}
      className={className}
      error={feedback.error ?? (invalid ? "Choose an option." : undefined)}
    >
      <input
        ref={input}
        type="hidden"
        name={name}
        value={current}
        disabled={disabled}
      />
      <div
        onInvalidCapture={(event) => {
          event.preventDefault();
          setInvalid(true);
          trigger.current?.focus();
        }}
      >
        <ShadcnSelect
          value={current || (emptyOption && !required ? EMPTY : "")}
          required={required}
          disabled={disabled}
          onValueChange={(next) => {
            const selected = next === EMPTY ? "" : next;
            if (!controlled) setInner(selected);
            setInvalid(false);
            feedback.clear();
            onValueChange?.(selected);
          }}
        >
          <SelectTrigger
            ref={trigger}
            id={id}
            className="w-full"
            aria-label={label ?? placeholder ?? name ?? "Choice"}
            aria-invalid={invalid || !!feedback.error || undefined}
            aria-describedby={
              [
                fieldHintId(id, optional, description),
                invalid || feedback.error ? `${id}-error` : null,
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) =>
              "options" in option ? (
                <Group key={option.id}>
                  <SelectLabel>{option.title}</SelectLabel>
                  {option.options.map(item)}
                </Group>
              ) : (
                item(option)
              ),
            )}
          </SelectContent>
        </ShadcnSelect>
      </div>
    </FieldFrame>
  );
}
