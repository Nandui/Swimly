"use client";

import { SegmentedChoice } from "@/components/ui-kit/segmented-links";

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
