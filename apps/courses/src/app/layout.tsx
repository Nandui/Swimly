import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./sheet.css";

/** Manrope, the one family (DESIGN.md), served from here so no page waits on another site. */
const manrope = localFont({ src: "./fonts/manrope-variable.woff2", weight: "200 800", style: "normal", variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "Turnfin Courses",
  description: "Swim classes, the pool deck, short courses and Academy courses.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/turnfin.png" },
};

/** The browser bar matches the ground. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0062b1" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
