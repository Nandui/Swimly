import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Figtree } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastBridge } from "@/lib/toast";
import { THEME_COOKIE, parseThemeMode } from "@/lib/theme-mode";
import "./globals.css";

/** Figtree is the Neutral theme's own face. Astryx never loads a font, so it
 *  comes through next/font: self-hosted at build time, `font-display: swap`,
 *  metrics reserved so nothing shifts when it arrives. The variable is what
 *  globals.css hands to the theme's font tokens. */
const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Swimly", template: "%s · Swimly" },
  description: "The leisure centre's swim lessons and bookings, in one place.",
};

/** `viewportFit: cover` lets the page run under the notch and the home
 *  indicator, which is what makes `env(safe-area-inset-*)` non-zero — the
 *  register's sticky Save bar pads by it. The theme colours tint the browser
 *  chrome to match the page ground in each mode. */
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
    // suppressHydrationWarning: Astryx's <Theme> keeps `data-theme` and
    // `data-astryx-theme` on <html> in step after mount.
    <html
      lang="en"
      suppressHydrationWarning
      className={figtree.variable}
      data-theme={mode === "system" ? undefined : mode}
    >
      <body>
        <ThemeProvider initialMode={mode}>
          <ToastBridge />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
