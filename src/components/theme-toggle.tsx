"use client";
import { RadioGroupItem, RadioGroup } from "@/components/shadcn/radio-group";

import { cn } from "@/lib/utils";

import { Moon, Sun } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

import {
  useResolvedThemeMode,
  useThemeMode,
} from "@/components/theme-provider";
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
    <RadioGroup
      value={mode}
      aria-label="Appearance"
      onValueChange={(next) => setMode(next as ThemeMode)}
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-ui-lg bg-ui-muted p-1",
        "max-w-sm",
      )}
    >
      {OPTIONS.map((option) => (
        <RadioGroupItem
          key={option.value}
          value={option.value}
          className={
            "aspect-auto h-auto min-h-11 w-auto flex-1 bg-transparent dark:bg-transparent dark:data-[state=checked]:bg-ui-input/30 rounded-ui-md border-0 px-3 py-2 text-sm font-medium shadow-none data-[state=checked]:bg-ui-background data-[state=checked]:text-ui-foreground data-[state=checked]:shadow-sm"
          }
        >
          {option.label}
        </RadioGroupItem>
      ))}
    </RadioGroup>
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
export function ThemeFlip({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const { setMode } = useThemeMode();
  const resolved = useResolvedThemeMode();
  const dark = resolved === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <IconButton
      label={label}
      variant="ghost"
      size={size === "sm" ? "icon-sm" : size === "lg" ? "icon-lg" : "icon"}
      onClick={() => setMode(dark ? "light" : "dark")}
    >
      <span className="grid size-4" aria-hidden="true">
        <span className="col-start-1 row-start-1" data-motion="theme-icon" data-active={dark}><Sun className="size-full" /></span>
        <span className="col-start-1 row-start-1" data-motion="theme-icon" data-active={!dark}><Moon className="size-full" /></span>
      </span>
    </IconButton>
  );
}
