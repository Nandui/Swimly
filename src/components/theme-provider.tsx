"use client";
import * as React from "react";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, type ThemeMode } from "@/lib/theme-mode";
type ThemeModeContextValue = { mode: ThemeMode; setMode: (mode: ThemeMode) => void };
const ThemeModeContext = React.createContext<ThemeModeContextValue | null>(null);
export function ThemeProvider({ initialMode, children }: { initialMode: ThemeMode; children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<ThemeMode>(initialMode);
  const setMode = React.useCallback((next: ThemeMode) => {
    setModeState(next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
  }, []);
  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.theme = mode === "system" ? (media.matches ? "dark" : "light") : mode; document.documentElement.classList.toggle("dark", mode === "dark" || (mode === "system" && media.matches)); };
    apply(); media.addEventListener("change", apply); return () => media.removeEventListener("change", apply);
  }, [mode]);
  const value = React.useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <ThemeModeContext value={value}>{children}</ThemeModeContext>;
}
export function useThemeMode(): ThemeModeContextValue { const ctx = React.use(ThemeModeContext); if (!ctx) throw new Error("useThemeMode needs a ThemeProvider."); return ctx; }
const DARK_QUERY = "(prefers-color-scheme: dark)";
function subscribeToScheme(onChange: () => void) { const media = window.matchMedia(DARK_QUERY); media.addEventListener("change", onChange); return () => media.removeEventListener("change", onChange); }
export function useResolvedThemeMode(): "light" | "dark" { const { mode } = useThemeMode(); const dark = React.useSyncExternalStore(subscribeToScheme, () => window.matchMedia(DARK_QUERY).matches, () => false); return mode === "system" ? (dark ? "dark" : "light") : mode; }
