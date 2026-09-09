
export type ThemeMode = "light" | "dark" | "system";

export const THEME_COOKIE = "swimly.theme";

/** A year. The choice is a preference, not a session. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseThemeMode(raw: string | undefined | null): ThemeMode {
  return raw === "light" || raw === "dark" ? raw : "system";
}
