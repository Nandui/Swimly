import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastBridge } from "@/lib/toast";
import { THEME_COOKIE, parseThemeMode } from "@/lib/theme-mode";
import { APP_NAME } from "@/lib/app";
// Figtree is self-hosted; theme tokens and form controls use the same family.
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "The leisure centre's swim lessons and bookings, in one place.",
};

/** `viewportFit: cover` lets the page run under the notch and the home
 *  indicator, which is what makes `env(safe-area-inset-*)` non-zero — the
 *  deck's save bar pads by it. The theme colours tint the browser chrome to
 *  match the page ground in each mode. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f1f1" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1b1b" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The mode is a cookie so it is known here, on the server: `data-theme` on
  // <html> sets `color-scheme` before any CSS runs, and the provider starts
  // from the same value, so the first paint is already right and hydration
  // has nothing to disagree about. No cookie means "follow the device".
  const jar = await cookies();
  const mode = parseThemeMode(jar.get(THEME_COOKIE)?.value);

  return (
    <html lang="en" suppressHydrationWarning data-theme={mode === "system" ? undefined : mode}>
      <body>
        <ThemeProvider initialMode={mode}>
          <ToastBridge />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
