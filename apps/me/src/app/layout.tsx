import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./globals.css";

/** No title here: each page renders its own `<title>` (Frame, sign-in, not-found), so there is
 *  exactly one, and it names the page ("My training · Turnfin Me"). */
export const metadata: Metadata = {
  description: "Your own training, reading, qualifications, shifts and HR, on your phone.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/apple-icon.png" },
  robots: { index: false, follow: false },
};

/** The status bar takes the canvas the top row sits on (--pc-canvas in globals.css). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1320" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body className="turnfin-app">{children}</body></html>;
}
