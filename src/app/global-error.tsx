"use client";

// global-error replaces the root layout, so it brings its own document, the
// typeface and the Turnfin Glass tokens. No theme provider: it follows the device.
import "./globals.css";
import "./theme/poolside.css";
import { inter } from "./fonts";
import { AuthFrame } from "@/components/auth-frame";
import { PageError } from "@/components/ui-kit/page-state";

/** An error in the root layout itself: the same state as src/app/error.tsx. */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="turnfin-app">
        <title>Something went wrong · Turnfin</title>
        <AuthFrame fin="start">
          <PageError retry={retry} />
        </AuthFrame>
      </body>
    </html>
  );
}
