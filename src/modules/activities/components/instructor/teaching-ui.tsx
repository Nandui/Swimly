"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
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
    <SegmentedChoice
      aria-label={label}
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      fill="phone"
      options={options}
    />
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
