import type { Metadata } from "next";
import { PageNotFound } from "@/components/ui-kit/page-state";

export const metadata: Metadata = { title: "Page not found" };

/** A page here that does not exist or that the role does not open, inside the module frame. */
export default function NotFound() {
  return <PageNotFound />;
}
