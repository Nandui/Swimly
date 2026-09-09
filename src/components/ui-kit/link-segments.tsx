"use client";

import { useRouter } from "next/navigation";
import { SegmentedControl, SegmentedControlItem } from "@/components/workspace/choices";

/** A segmented control whose choice lives in the URL, like the tabs do and
 *  for the same reasons: a link somebody sends carries it, and the back
 *  button undoes it. Picking a segment navigates without scrolling. */
export function LinkSegments({
  label,
  value,
  options,
  size = "md",
}: {
  label: string;
  value: string;
  options: { value: string; label: string; href: string }[];
  size?: "sm" | "md" | "lg";
}) {
  const router = useRouter();
  return (
    <SegmentedControl
      label={label}
      value={value}
      size={size}
      onChange={(next) => {
        const option = options.find((o) => o.value === next);
        if (option) router.push(option.href, { scroll: false });
      }}
    >
      {options.map((option) => (
        <SegmentedControlItem key={option.value} value={option.value} label={option.label} />
      ))}
    </SegmentedControl>
  );
}
