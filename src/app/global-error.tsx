"use client";

// global-error replaces the root layout, so it brings its own document, the
// typeface and the Poolside Clear tokens. No theme provider: it follows the device.
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./globals.css";
import "./docs/poolside.css";
import { AuthFrame } from "@/components/auth-frame";
import { PageError } from "@/components/ui-kit/page-state";

/** An error in the root layout itself: the same state as src/app/error.tsx. */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="turnfin-app">
        <title>Something went wrong · Turnfin</title>
        <AuthFrame fin="start">
          <PageError retry={retry} />
        </AuthFrame>
      </body>
    </html>
  );
}
