"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

/** True on the client after hydration, false in the server render — without an
 *  effect or a state update, which is what the lint rule (rightly) objects to.
 *  `useSyncExternalStore` with a constant client snapshot is the idiomatic way
 *  to ask "am I hydrated yet?". */
function useHydrated() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/** Which mode this person wants, remembered in this browser.
 *
 *  A segmented control of three buttons with `aria-pressed`, so a screen reader
 *  hears which is chosen. It renders a placeholder until hydrated: the theme
 *  lives in localStorage, which the server cannot read, so anything drawn
 *  before then would be a guess that then jumps. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  if (!hydrated) return <div className="h-8" aria-hidden />;

  return (
    <div role="group" aria-label="Appearance" className="inline-flex rounded-md border p-0.5">
      {OPTIONS.map((option) => {
        const active = (theme ?? "system") === option.value;
        const Icon = option.icon;
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={active ? "secondary" : "ghost"}
            aria-pressed={active}
            onClick={() => setTheme(option.value)}
          >
            <Icon className="size-3.5" />
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
