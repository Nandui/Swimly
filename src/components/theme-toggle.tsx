"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { useResolvedThemeMode, useThemeMode } from "@/components/theme-provider";
import type { ThemeMode } from "@/lib/theme-mode";

const OPTIONS: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/** Which mode this person wants, remembered in this browser.
 *
 *  Three buttons with `aria-pressed`, so a screen reader hears which is
 *  chosen. The mode comes from a cookie the server already read, so there is
 *  nothing to wait for before drawing it. */
export function ThemeToggle() {
  const { mode, setMode } = useThemeMode();

  return (
    <div role="group" aria-label="Appearance" className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => {
        const active = mode === option.value;
        const Icon = option.icon;
        return (
          <Button
            key={option.value}
            label={option.label}
            variant={active ? "primary" : "secondary"}
            size="md"
            icon={<Icon className="size-4" aria-hidden />}
            aria-pressed={active}
            onClick={() => setMode(option.value)}
          />
        );
      })}
    </div>
  );
}

/** One tap, the other mode. Lives in the sidebar's footer and in the phone
 *  bar, so the flip is never more than a tap away — the deck is bright at
 *  noon and dim at seven, and nobody should have to find a settings page for
 *  that.
 *
 *  It flips the *resolved* mode, so it works whether the current setting is an
 *  explicit choice or "follow the device". Flipping sets an explicit choice;
 *  the three-way control on the Account page is where "system" is restored.
 *  The icon shows the mode you would get by tapping, which is the convention
 *  people already know from every other app. */
export function ThemeFlip({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  const { setMode } = useThemeMode();
  const resolved = useResolvedThemeMode();
  const dark = resolved === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <IconButton
      label={label}
      tooltip={label}
      variant="ghost"
      size={size}
      icon={dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
      onClick={() => setMode(dark ? "light" : "dark")}
    />
  );
}
