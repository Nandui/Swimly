"use client";
import { useId, type ComponentProps } from "react";
import { Textarea as Control } from "@/components/primitives/textarea";
import { Field } from "@/components/workspace/fields";
export type TextareaProps = Omit<ComponentProps<"textarea">, "defaultValue"> & { label?: string; description?: string; defaultValue?: string | null };
export function Textarea({ label, description, id, defaultValue, ...props }: TextareaProps) {
  const generatedId = useId(); const inputId = id ?? generatedId;
  return <Field label={label ?? ""} isLabelHidden={!label} inputID={inputId} description={description}><Control {...props} id={inputId} defaultValue={defaultValue ?? undefined} aria-describedby={description ? `${inputId}-hint` : undefined} /></Field>;
}
