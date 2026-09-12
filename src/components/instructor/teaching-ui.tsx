"use client";

import { Check, Info } from "lucide-react";
import type { ReactNode } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import { Alert, AlertTitle, AlertDescription } from "@/components/shadcn/alert";

/** The same keyboard-operable, thumb-sized choice for attendance and skills. */
export function MarkChoices({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      orientation="horizontal"
      className="flex w-full gap-1 rounded-ui-lg border border-ui-border bg-ui-muted p-1 sm:w-auto"
    >
      {options.map((option) => (
        <RadioGroupItem
          key={option.value}
          value={option.value}
          className="flex aspect-auto h-11 w-auto min-w-0 flex-1 items-center justify-center gap-1.5 rounded-ui-md border-transparent px-3 text-sm text-ui-muted-foreground shadow-none data-[state=checked]:border-ui-input data-[state=checked]:bg-ui-background data-[state=checked]:font-semibold data-[state=checked]:text-ui-foreground sm:flex-none"
        >
          {value === option.value ? (
            <Check className="size-4 shrink-0" aria-hidden="true" />
          ) : null}
          {option.label}
        </RadioGroupItem>
      ))}
    </RadioGroup>
  );
}

export function TeachingNotice({
  title,
  children,
  error = false,
}: {
  title: string;
  children?: ReactNode;
  error?: boolean;
}) {
  return (
    <Alert variant={error ? "destructive" : "default"}>
      <Info aria-hidden="true" />
      <AlertTitle className="line-clamp-none leading-relaxed">
        {title}
      </AlertTitle>
      {children ? <AlertDescription>{children}</AlertDescription> : null}
    </Alert>
  );
}
