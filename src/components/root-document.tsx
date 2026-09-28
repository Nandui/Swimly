import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastBridge } from "@/lib/toast";
import { TooltipProvider } from "@/components/shadcn/tooltip";
import { THEME_COOKIE, parseThemeMode } from "@/lib/theme-mode";
import { APP_NAME } from "@/lib/app";
import { auth } from "@/auth";
import { SharedDeviceIdle } from "@/components/devices/session-forms";
import { SHARED_IDLE_MINUTES } from "@/lib/devices/constants";

/** The document every Turnfin app renders (Work and Activities), so the
 *  apps look and behave as one: Poolside Clear on `.turnfin-app`, the saved
 *  appearance before first paint, toasts, tooltips and the shared-device idle
 *  sign-out. Each app's root layout imports the stylesheets itself. */

export const rootMetadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "The leisure centre's swim lessons and bookings, in one place.",
  icons: {
    icon: { url: "/brand/app-logo.png", type: "image/png" },
    apple: { url: "/brand/app-logo.png", type: "image/png" },
  },
};

/** `viewportFit: cover` lets the page run under the notch and the home
 *  indicator, which is what makes `env(safe-area-inset-*)` non-zero — the
 *  deck's save bar pads by it. The theme colours tint the browser chrome to
 *  match the page ground in each mode. */
export const rootViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f8f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b161a" },
  ],
};

export async function RootDocument({ children }: { children: ReactNode }) {
  // The mode is a cookie so it is known here, on the server: `data-theme` on
  // <html> sets `color-scheme` before any CSS runs, and the provider starts
  // from the same value, so the first paint is already right and hydration
  // has nothing to disagree about. No cookie means "follow the device".
  const jar = await cookies();
  const mode = parseThemeMode(jar.get(THEME_COOKIE)?.value);
  // Shared reception computers and poolside tablets return to the switch
  // screen when left idle, so nobody walks up to someone else's session.
  const shared = (await auth())?.user?.sharedDevice === true;

  return (
    // The appearance provider updates this attribute when the preference changes.
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={mode === "system" ? undefined : mode}
    >
      <body className="turnfin-app">
        <ThemeProvider initialMode={mode}>
          <TooltipProvider>
            <ToastBridge />
            {shared ? <SharedDeviceIdle minutes={SHARED_IDLE_MINUTES} /> : null}
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
