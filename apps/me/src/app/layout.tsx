import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./theme/kit.css";
import "./me.css";
import { inter } from "./fonts";
import { GlassRoot } from "@/components/ui-kit/glass";
import { LiveBannerProvider } from "@/components/ui-kit/live-banner";

/** No title here: each page renders its own `<title>` (Frame, sign-in, not-found), so there is
 *  exactly one, and it names the page ("My training · Turnfin Me"). */
export const metadata: Metadata = {
  description: "Your own training, reading, qualifications, shifts and HR, on your phone.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/apple-icon.png" },
  robots: { index: false, follow: false },
};

/** The status bar takes the page's ground (--bg in theme/glass.css). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className={inter.variable}><body className="turnfin-app"><GlassRoot /><LiveBannerProvider>{children}</LiveBannerProvider></body></html>;
}
