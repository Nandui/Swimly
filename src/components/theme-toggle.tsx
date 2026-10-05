"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";

import {
  useResolvedThemeMode,
  useThemeMode,
} from "@/components/theme-provider";
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

/** One tap, the other mode. Lives in the desk sidebar and mobile/deck toolbar, so the flip is
 *  never more than a tap away — the deck is bright at noon and dim at seven,
 *  and nobody should have to find a settings page for that.
 *
 *  It flips the *resolved* mode, so it works whether the current setting is an
 *  explicit choice or "follow the device". Flipping sets an explicit choice;
 *  the three-way control on the Account page is where "system" is restored.
 *  The icon shows the mode you would get by tapping, which is the convention
 *  people already know from every other app. */
export function ThemeFlip() {
  const { setMode } = useThemeMode();
  const resolved = useResolvedThemeMode();
  const dark = resolved === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <IconButton
      label={label}
      variant="ghost"
      size="icon"
      onClick={() => setMode(dark ? "light" : "dark")}
    >
      <span className="grid size-4" aria-hidden="true">
        <span className="col-start-1 row-start-1" data-motion="theme-icon" data-active={dark}><Sun className="size-full" /></span>
        <span className="col-start-1 row-start-1" data-motion="theme-icon" data-active={!dark}><Moon className="size-full" /></span>
      </span>
    </IconButton>
  );
}
