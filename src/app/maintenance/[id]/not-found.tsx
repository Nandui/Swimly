import type { Metadata } from "next";
import { PageNotFound } from "@/components/ui-kit/page-state";

export const metadata: Metadata = { title: "Page not found" };

/** A request that does not exist, or one at a site this person does not cover. */
export default function RequestNotFound() {
  return <PageNotFound title="Request unavailable" hint="It may be at a site your role does not cover." href="/maintenance" actionLabel="Back to requests" />;
}
