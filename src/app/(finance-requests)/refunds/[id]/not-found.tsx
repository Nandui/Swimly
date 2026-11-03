import type { Metadata } from "next";
import { PageNotFound } from "@/components/ui-kit/page-state";

export const metadata: Metadata = { title: "Page not found" };

/** A request that does not exist, or a colleague's draft this person cannot open. */
export default function RequestNotFound() {
  return <PageNotFound title="Request unavailable" hint="It may be a colleague’s draft or it was removed." href="/refunds" actionLabel="Back to requests" />;
}
