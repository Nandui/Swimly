import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { RecordWellbeing, WellbeingLinkClosed, wellbeingLink } from "@/modules/incidents/features/wellbeing";

export const metadata: Metadata = { title: "Wellbeing check", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** The page a wellbeing check's email to HR links to (docs/incidents.md):
 *  no sign-in, one request, nothing else of the report. */
export default async function WellbeingLinkPage({ params }: PageProps<"/wellbeing/[token]">) {
  const { token } = await params;
  const link = await wellbeingLink(token);
  if (!link) notFound();
  return (
    <AuthFrame fin="start">
      {link.problem ? <WellbeingLinkClosed problem={link.problem} askedBy={link.requestedByName} /> : <RecordWellbeing token={token} link={link} />}
    </AuthFrame>
  );
}
