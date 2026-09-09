"use client";
import { useId, type ComponentProps } from "react";
import { Input as Control } from "@/components/primitives/input";
import { Field } from "@/components/workspace/fields";
export type InputProps = Omit<ComponentProps<"input">, "size" | "value" | "defaultValue" | "onChange"> & { label?: string; description?: string; value?: string; defaultValue?: string | number | null; onChange?: (value: string) => void; };
export function Input({ label, description, id, defaultValue, onChange, ...props }: InputProps) {
  const generatedId = useId(); const inputId = id ?? generatedId;
  return <Field label={label ?? ""} isLabelHidden={!label} inputID={inputId} description={description}><Control {...props} id={inputId} defaultValue={defaultValue ?? undefined} onChange={(event) => onChange?.(event.target.value)} aria-describedby={description ? `${inputId}-hint` : undefined} /></Field>;
}
