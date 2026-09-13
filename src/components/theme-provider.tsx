"use client";

import * as React from "react";
import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  type ThemeMode,
} from "@/lib/theme-mode";

/** The server cookie seeds the first paint; CSS resolves system appearance. */

type ThemeModeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeModeContext = React.createContext<ThemeModeContextValue | null>(
  null,
);

export function ThemeProvider({
  initialMode,
  children,
}: {
  initialMode: ThemeMode;
  children: React.ReactNode;
}) {
  const [mode, setModeState] = React.useState<ThemeMode>(initialMode);

  React.useEffect(() => {
    if (mode === "system")
      document.documentElement.removeAttribute("data-theme");
    else document.documentElement.dataset.theme = mode;
  }, [mode]);

  const setMode = React.useCallback((next: ThemeMode) => {
    setModeState(next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
  }, []);

  const value = React.useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return <ThemeModeContext value={value}>{children}</ThemeModeContext>;
}

/** The chosen mode and the way to change it. */
export function useThemeMode(): ThemeModeContextValue {
  const ctx = React.use(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode needs a <ThemeProvider> above it.");
  return ctx;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToScheme(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** What is actually on screen: the choice, or the device's answer when the
 *  choice is "system". The server says "light", and a device that prefers
 *  dark corrects it right after hydration — which only ever matters for the
 *  flip button's icon, never for a colour, since the colours come from CSS
 *  and never asked JavaScript. */
export function useResolvedThemeMode(): "light" | "dark" {
  const { mode } = useThemeMode();
  const systemDark = React.useSyncExternalStore(
    subscribeToScheme,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
  if (mode === "system") return systemDark ? "dark" : "light";
  return mode;
}
