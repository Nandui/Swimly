import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./plain.css";

export const metadata: Metadata = {
  title: "Turnfin Courses",
  description: "Swim classes, the pool deck, short courses and Academy courses.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Plain until the design is approved (docs/courses.md, step 2). */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
