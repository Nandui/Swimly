"use client";

import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field } from "@/components/form-dialog";
import { clock, parseClock } from "@/modules/plan/shared/rules";

/** Plan (test)'s small form fields: a time in 5-minute steps, and a choice from a list. */

export function TimeField({ id, label, value, onChange, hint }: { id: string; label: string; value: number | null; onChange: (minutes: number | null) => void; hint?: string }) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input id={id} type="time" step={300} required className="min-h-11" value={value === null ? "" : clock(Math.min(value, 1439))}
        onChange={(e) => onChange(parseClock(e.target.value))} />
    </Field>
  );
}

export function ChoiceField({ id, label, value, onChange, options, empty, hint, optional }: {
  id: string; label: string; value: string; onChange: (value: string) => void; options: { id: string; name: string }[];
  /** The first, empty choice: "Choose one" (required) or "None" (optional). */
  empty: string; hint?: string; optional?: boolean;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint} optional={optional}>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)} required={!optional} className="min-h-11 w-full">
        <NativeSelectOption value="" disabled={!optional}>{empty}</NativeSelectOption>
        {options.map((o) => <NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>)}
      </NativeSelect>
    </Field>
  );
}
