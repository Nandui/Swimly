import type { Metadata } from "next";
import { PageNotFound } from "@/components/ui-kit/page-state";

export const metadata: Metadata = { title: "Page not found" };

/** Reached from a document page's own notFound() (documents/[id], /edit and
 *  /history); a refused membership 404s in the Docs layout and lands on the
 *  root not-found instead, so this link is never a dead end. */
export default function DocumentNotFound() {
  return <PageNotFound title="This document isn’t available" href="/docs/library" actionLabel="Back to the document library" />;
}
