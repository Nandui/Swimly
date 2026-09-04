import type { Metadata, Viewport } from "next";
import { Outfit, Work_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/** The pairing MASTER.md prescribes — "Geometric Modern": Work Sans to read,
 *  Outfit for headings. Loaded through next/font rather than the stylesheet
 *  import the system suggests, because that self-hosts the files at build
 *  time, sets font-display: swap, and reserves the metrics so nothing shifts
 *  when they arrive — the skill's own Next.js guidance. */
const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-work-sans",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Swimly", template: "%s · Swimly" },
  description: "The leisure centre's swim lessons and bookings, in one place.",
};

/** `viewportFit: cover` lets the page run under the notch and the home
 *  indicator, which is what makes `env(safe-area-inset-*)` non-zero — the
 *  register's sticky Save bar pads by it. The theme colours tint the browser
 *  chrome to match the sidebar in each mode. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f5fd" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes writes the `dark` class onto <html>
    // before React hydrates, and React would otherwise report the mismatch.
    <html lang="en" suppressHydrationWarning className={`${workSans.variable} ${outfit.variable}`}>
      <body>
        {/* Both modes, and the operating system chooses by default. The Toaster
            reads the same theme, so it is no longer pinned to one. */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
