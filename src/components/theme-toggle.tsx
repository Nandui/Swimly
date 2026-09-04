"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <ThemeSegments theme={theme ?? "system"} setTheme={setTheme} />
  );
}

/** One click, the other mode. Lives in the sidebar and the mobile bar, so the
 *  flip is always a single tap away — the deck is bright at noon and dim at
 *  seven, and nobody should have to find a settings page for that.
 *
 *  It flips the *resolved* mode, so it works whether the current setting is an
 *  explicit choice or "follow the system". Flipping does set an explicit
 *  choice; the three-way control on the Account page is where "system" is
 *  restored. Icon shows the mode you would get by clicking, which is the
 *  convention people already know from every other app. */
export function ThemeFlip({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();

  if (!hydrated) {
    return <span className={cn("inline-block size-7 max-md:size-10", className)} aria-hidden />;
  }

  const dark = resolvedTheme === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded text-muted-foreground/70 transition-colors max-md:size-10",
        "hover:bg-sidebar-accent hover:text-foreground",
        "outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50",
        className
      )}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function ThemeSegments({ theme, setTheme }: { theme: string; setTheme: (t: string) => void }) {

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
