import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import "./globals.css";
import "./theme/poolside.css";
import "./theme/leisureworld.css";
import "./academy.css";

/** The parents app's font (LeisureWorld Aquatics), so the two sites read as one family. */
const manrope = localFont({
  src: "./fonts/manrope-variable.woff2",
  weight: "200 800",
  style: "normal",
  variable: "--font-manrope",
  adjustFontFallback: false,
  display: "swap",
});

/** No title here: each page renders its own `<title>` (Frame), so there is exactly one. */
export const metadata: Metadata = {
  description: "Lifeguard and swim teacher courses. Book a place online and we phone you to take payment.",
  icons: { icon: "/icon-192.png", apple: "/apple-icon.png" },
};

/** The browser bar matches the navy header in both modes. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07345E",
};

/** Light, dark or the device's choice, kept in a cookie as on the parents app. */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const preference = (await cookies()).get("academy-theme")?.value;
  const theme = preference === "light" || preference === "dark" ? preference : undefined;
  return (
    <html lang="en" className={manrope.variable} data-theme={theme}>
      <body className="turnfin-app lw-brand">{children}</body>
    </html>
  );
}
