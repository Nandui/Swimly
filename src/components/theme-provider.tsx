"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/** A client wrapper around next-themes, so the server layout can mount it.
 *  It sets `class="dark"` on <html>, which is what the `dark` custom variant in
 *  globals.css keys on, and remembers the choice in localStorage. */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
