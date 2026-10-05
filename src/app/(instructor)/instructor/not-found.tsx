import type { Metadata } from "next";
import { PageNotFound } from "@/components/ui-kit/page-state";

export const metadata: Metadata = { title: "Page not found" };

/** Any deck page that does not exist or is not open to this person (a class,
 *  an assessment, a swimmer), so the copy stays neutral and leads back to classes. */
export default function NotFound() {
  return <PageNotFound href="/instructor" actionLabel="Back to classes" />;
}
