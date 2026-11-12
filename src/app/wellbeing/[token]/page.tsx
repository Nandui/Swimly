import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { RecordWellbeing, WellbeingLinkClosed, wellbeingLink } from "@/modules/incidents/features/wellbeing";

export const metadata: Metadata = { title: "Request to HR", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** The page a request's email to HR links to (a wellbeing check, or a staff member in an incident):
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
