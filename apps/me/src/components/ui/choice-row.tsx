"use client";

import * as React from "react";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Label } from "@/components/shadcn/label";
import { RadioGroupItem } from "@/components/shadcn/radio-group";
import { cn } from "@/lib/utils";

type RowText = {
  /** The option's name, at body size and 600. */
  title: React.ReactNode;
  /** One caption line under the name, muted at 400. */
  hint?: React.ReactNode;
  /** Classes for the row (the label), not the control. */
  className?: string;
};

type RadioRowProps = RowText & { type: "radio" } & Omit<React.ComponentProps<typeof RadioGroupItem>, "children" | "className" | "type">;
type CheckboxRowProps = RowText & { type: "checkbox" } & Omit<React.ComponentProps<typeof Checkbox>, "children" | "className" | "type">;

/** A radio or checkbox option drawn as a whole-row target (Poolside Clear v2, HRPerson): the
 *  control sits inside its label, so the full 56px row picks it. Radios go inside a RadioGroup;
 *  both post through FormData like the bare shadcn controls. The name is the title; the hint
 *  describes it. */
export function ChoiceRow({ title, hint, className, type: kind, ...control }: RadioRowProps | CheckboxRowProps) {
  const generatedId = React.useId();
  const id = control.id ?? generatedId;
  const titleId = `${id}-title`;
  const hintId = hint ? `${id}-hint` : undefined;
  const a11y = {
    id,
    "aria-labelledby": titleId,
    "aria-describedby": [control["aria-describedby"], hintId].filter(Boolean).join(" ") || undefined,
  };
  return (
    <Label htmlFor={id} className={cn("pc-row", className)}>
      {kind === "radio" ? (
        <RadioGroupItem {...(control as Omit<RadioRowProps, keyof RowText | "type">)} {...a11y} />
      ) : (
        <Checkbox {...(control as Omit<CheckboxRowProps, keyof RowText | "type">)} {...a11y} />
      )}
      <span className="pc-row-body">
        <span id={titleId} className="pc-row-title">{title}</span>
        {hint ? <span id={hintId} className="pc-row-hint">{hint}</span> : null}
      </span>
    </Label>
  );
}
