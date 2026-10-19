import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { FootageLinkClosed, footageLink, UploadFootage } from "@/modules/incidents/features/footage";

export const metadata: Metadata = { title: "Send CCTV footage", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** The page a CCTV footage request's email links to (docs/incidents.md):
 *  no sign-in, one request, nothing else of the report. */
export default async function FootageLinkPage({ params }: PageProps<"/footage/[token]">) {
  const { token } = await params;
  const link = await footageLink(token);
  if (!link) notFound();
  return (
    <AuthFrame fin="start">
      {link.problem ? <FootageLinkClosed problem={link.problem} askedBy={link.requestedByName} /> : <UploadFootage token={token} link={link} />}
    </AuthFrame>
  );
}
