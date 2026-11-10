import type { Metadata } from "next";
import { PageNotFound } from "@/components/ui-kit/page-state";

export const metadata: Metadata = { title: "Page not found" };

/** An assessment that does not exist, a draft this person does not write, or one at a site they
 *  do not cover. */
export default function AssessmentNotFound() {
  return <PageNotFound title="Assessment unavailable" hint="It may be a draft, or at a site your role does not cover." href="/risk-assessments" actionLabel="Back to assessments" />;
}
