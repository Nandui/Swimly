import type { Metadata } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/** The pairing MASTER.md prescribes — "Dashboard Data": Fira Sans to read,
 *  Fira Code for headings and figures. Loaded through next/font rather than the
 *  stylesheet import the system suggests, because that self-hosts the files at
 *  build time, sets font-display: swap, and reserves the metrics so nothing
 *  shifts when they arrive — the skill's own Next.js guidance. */
const firaSans = Fira_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-fira-sans",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Swimly", template: "%s · Swimly" },
  description: "The swim school, in one place: swimmers, classes, registers and progress.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes writes the `dark` class onto <html>
    // before React hydrates, and React would otherwise report the mismatch.
    <html lang="en" suppressHydrationWarning className={`${firaSans.variable} ${firaCode.variable}`}>
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
