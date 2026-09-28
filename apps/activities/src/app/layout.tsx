import { RootDocument, rootMetadata, rootViewport } from "@/components/root-document";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./activities.css";

export const metadata = rootMetadata;
export const viewport = rootViewport;

/** Turnfin Activities: the swim school's office, desk and pool deck, and the
 *  parent API. The same document as Turnfin Work, so moving between the two
 *  apps looks like one product. */
export default async function ActivitiesRootLayout({ children }: LayoutProps<"/">) {
  return <RootDocument>{children}</RootDocument>;
}
