"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { useThemeMode } from "@/components/theme-provider";
import { parseThemeMode } from "@/lib/theme-mode";

const OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/** Which mode this person wants, remembered in this browser: exactly one of
 *  three, which is what a segmented control is for. The same bar, icons and
 *  labels as Appearance in the account menu. The mode comes from a cookie the
 *  server already read, so there is nothing to wait for before drawing it. */
export function ThemeToggle() {
  const { mode, setMode } = useThemeMode();

  return (
    <SegmentedChoice
      aria-label="Appearance"
      fill="phone"
      value={mode}
      onValueChange={(next) => setMode(parseThemeMode(next))}
      options={OPTIONS}
    />
  );
}
