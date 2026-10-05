import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastBridge } from "@/lib/toast";
import { TooltipProvider } from "@/components/shadcn/tooltip";
import { THEME_COOKIE, parseThemeMode } from "@/lib/theme-mode";
import { APP_NAME, TITLE_TEMPLATE } from "@/lib/app";
import { auth } from "@/auth";
import { SharedDeviceIdle } from "@/components/devices/session-forms";
import { SHARED_IDLE_MINUTES } from "@/lib/devices/constants";
import { DevelopmentRolePreview } from "@/components/staff/development-role-preview";
import { YourModulesProvider } from "@/components/workspace/your-modules";
import { modulesFor } from "@/modules/context";
import { getCurrentClub } from "@/lib/clubs/current";
// Poolside Clear across the whole app: its typeface, self-hosted in every
// environment, and its tokens and system rules (scoped to .turnfin-app on <body>).
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./globals.css";
import "./docs/poolside.css";

/** One template all the way down: a layout that sets a title must also set
 *  TITLE_TEMPLATE. The browser and home-screen icons are the fin, from the
 *  file conventions src/app/icon.png and src/app/apple-icon.png, so nothing
 *  may set `icons` (one entry would turn the file icon off on that route). */
export const metadata: Metadata = {
  title: { default: APP_NAME, template: TITLE_TEMPLATE },
  description: "Swim school, pool deck, refunds, documents, training, rota and HR for leisure centre teams, in one place.",
};

/** `viewportFit: cover` lets the page run under the notch and the home
 *  indicator, which is what makes `env(safe-area-inset-*)` non-zero — the
 *  deck's save bar pads by it. The theme colours tint the browser chrome to
 *  match the ground in each mode, the same rule as the body background in
 *  poolside.css: --pc-canvas below 768px, where the frame is the page, and
 *  --pc-outer from 768px, where the frame sits on the outer ground. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light) and (max-width: 767px)", color: "#eef2f6" },
    { media: "(prefers-color-scheme: dark) and (max-width: 767px)", color: "#0c1320" },
    { media: "(prefers-color-scheme: light) and (min-width: 768px)", color: "#f7f9fb" },
    { media: "(prefers-color-scheme: dark) and (min-width: 768px)", color: "#070c14" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The mode is a cookie so it is known here, on the server: `data-theme` on
  // <html> sets `color-scheme` before any CSS runs, and the provider starts
  // from the same value, so the first paint is already right and hydration
  // has nothing to disagree about. No cookie means "follow the device".
  const jar = await cookies();
  const mode = parseThemeMode(jar.get(THEME_COOKIE)?.value);
  // Shared reception computers and poolside tablets return to the switch
  // screen when left idle, so nobody walks up to someone else's session.
  const session = await auth();
  const shared = session?.user?.sharedDevice === true;
  // The working site for the account menu's caption. auth() has already asked
  // for it in this request's cache, so this costs no query; it throws when no
  // site exists yet (as in auth.ts). switchClub revalidates this layout.
  let site = "";
  if (session?.user) {
    try { site = (await getCurrentClub()).club.name; } catch { site = ""; }
  }

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
            {/* Dev builds only: someone who manages roles sees any page as any
                role would, from "View as" in the frame's tools bar. Gives the
                toggle nothing on production. */}
            <DevelopmentRolePreview session={session}>
              <YourModulesProvider
                ids={session?.user ? modulesFor(session).map((m) => m.id) : []}
                role={session?.user?.roleName ?? ""}
                site={site}
              >
                {children}
              </YourModulesProvider>
            </DevelopmentRolePreview>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
