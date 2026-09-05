/** Light, dark, or whatever the device says. The choice is a cookie rather
 *  than localStorage so the server can render the right mode on the first
 *  paint: the root layout reads it, stamps `data-theme` on <html>, and hands
 *  the same value to the Astryx <Theme>, so nothing flashes and nothing
 *  disagrees on hydration. */
export type ThemeMode = "light" | "dark" | "system";

export const THEME_COOKIE = "swimly.theme";

/** A year. The choice is a preference, not a session. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseThemeMode(raw: string | undefined | null): ThemeMode {
  return raw === "light" || raw === "dark" ? raw : "system";
}
