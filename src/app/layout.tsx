import { RootDocument, rootMetadata, rootViewport } from "@/components/root-document";
// Poolside Clear across the whole app: its typeface, self-hosted in every
// environment, and its tokens and system rules (scoped to .turnfin-app on <body>).
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./globals.css";
import "./docs/poolside.css";

export const metadata = rootMetadata;
export const viewport = rootViewport;

/** Turnfin Work: Core and the Work modules. Activities is its own app
 *  (apps/activities), reached through the rewrites in next.config.ts. */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  return <RootDocument>{children}</RootDocument>;
}
