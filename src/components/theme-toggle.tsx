"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { useResolvedThemeMode, useThemeMode } from "@/components/theme-provider";
import type { ThemeMode } from "@/lib/theme-mode";

const OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Which mode this person wants, remembered in this browser: exactly one of
 *  three, which is what a segmented control is for. The mode comes from a
 *  cookie the server already read, so there is nothing to wait for before
 *  drawing it. */
export function ThemeToggle() {
  const { mode, setMode } = useThemeMode();

  return (
    <SegmentedControl
      label="Appearance"
      value={mode}
      onChange={(next) => setMode(next as ThemeMode)}
      size="lg"
      layout="fill"
      className="max-w-sm"
    >
      {OPTIONS.map((option) => (
        <SegmentedControlItem
          key={option.value}
          value={option.value}
          label={option.label}
        />
      ))}
    </SegmentedControl>
  );
}

/** One tap, the other mode. Lives at the end of the top bar, so the flip is
 *  never more than a tap away — the deck is bright at noon and dim at seven,
 *  and nobody should have to find a settings page for that.
 *
 *  It flips the *resolved* mode, so it works whether the current setting is an
 *  explicit choice or "follow the device". Flipping sets an explicit choice;
 *  the three-way control on the Account page is where "system" is restored.
 *  The icon shows the mode you would get by tapping, which is the convention
 *  people already know from every other app. */
export function ThemeFlip({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const { setMode } = useThemeMode();
  const resolved = useResolvedThemeMode();
  const dark = resolved === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Button aria-label={label} title={label} variant="ghost" size={size === "sm" ? "icon-sm" : size === "lg" ? "icon-lg" : "icon"} onClick={() => setMode(dark ? "light" : "dark")}>
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  );
}
