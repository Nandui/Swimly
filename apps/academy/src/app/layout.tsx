import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./globals.css";

/** No title here: each page renders its own `<title>` (Frame), so there is exactly one. */
export const metadata: Metadata = {
  description: "Lifeguard and swim teacher courses. Book a place online and we phone you to take payment.",
  icons: { icon: "/icon-192.png", apple: "/apple-icon.png" },
};

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
