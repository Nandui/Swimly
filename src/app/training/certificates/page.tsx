import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Paperclip } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import { DeclineCertificate, VerifyCertificate } from "@/components/training/certificate-actions";
import { formatDate, formatDateTime, nameInitials } from "@/lib/format";
import { certificateQueue } from "@/lib/training/certificates";
import { CERTIFICATE_STATUS_META } from "@/lib/training/constants";

export const metadata: Metadata = { title: "Certificates to check" };

/** Certificates staff uploaded in Turnfin Me, for the people the reader's
 *  qualifications role covers. Recording one adds it to their record. */
export default async function CertificatesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const done = (await searchParams).view === "done";
  const { who, rows, types } = await certificateQueue(done ? "DONE" : "PENDING");
  if (!who.qualifications) notFound();
  return (
    <>
      <PageHeader
        title="Certificates to check"
        description={done ? "Recently checked certificates" : "Open each file, check it, then record it or decline it with a reason"}
      />
      <SegmentedLinks label="Certificates" items={[
        { href: "/training/certificates", label: "Waiting", current: !done },
        { href: "/training/certificates?view=done", label: "Checked", current: done },
      ]} />
      {rows.length === 0 ? (
        <EmptyState as="h2" icon="certificate" title={done ? "Nothing checked yet" : "Nothing waiting"} hint="Staff upload certificates in Turnfin Me. They appear here for the people you cover." />
      ) : (
        <section className="pc-panel" aria-label={done ? "Checked certificates" : "Certificates waiting"}>
          <ul className="pc-rows">
            {rows.map((row) => {
              const status = CERTIFICATE_STATUS_META[row.status as keyof typeof CERTIFICATE_STATUS_META];
              return (
                <li key={row.id} className="pc-row">
                  <Avatar size="lg" aria-hidden="true"><AvatarFallback>{nameInitials(row.person.name)}</AvatarFallback></Avatar>
                  <div className="pc-row-body">
                    <Link href={`/training/people/${row.person.id}`} className="pc-row-title -my-3 inline-flex min-h-11 items-center self-start underline-offset-4 hover:underline">{row.person.name}</Link>
                    <p className="pc-row-hint">
                      {[row.typeName || "Qualification not named", row.reference || null, row.issuedOn ? `Issued ${formatDate(row.issuedOn)}` : null, row.expiresOn ? `expires ${formatDate(row.expiresOn)}` : null, `sent ${formatDateTime(row.createdAt)}`].filter(Boolean).join(" · ")}
                    </p>
                    {row.status !== "PENDING" ? <p className="pc-row-hint">{[row.reviewedByName, row.reviewedAt ? formatDateTime(row.reviewedAt) : null, row.reviewNote || null].filter(Boolean).join(" · ")}</p> : null}
                    <Button asChild variant="link" className="min-h-11 self-start whitespace-normal text-start">
                      <a href={`/training/certificates/${row.id}/file`} target="_blank" rel="noopener noreferrer">
                        <Paperclip aria-hidden="true" />Open {row.fileName} ({Math.ceil(row.size / 1024)} KB)<span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </Button>
                  </div>
                  <div className="pc-row-trail">
                    {status ? <Tag meta={status} /> : null}
                    {row.status === "PENDING" ? (
                      <>
                        <DeclineCertificate id={row.id} name={row.person.name} />
                        <VerifyCertificate row={row} types={types} />
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
