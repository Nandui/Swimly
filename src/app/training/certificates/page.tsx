import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { DeclineCertificate, VerifyCertificate } from "@/components/training/certificate-actions";
import { formatDate, formatDateTime } from "@/lib/format";
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
    <div className="space-y-6">
      <div className="module-heading">
        <div className="space-y-2">
          <h1>Certificates to check</h1>
          <p className="text-sm">
            {done ? "Recently checked certificates." : "Open each file, check it, then record it or decline it with a reason."}{" "}
            <Link className="underline underline-offset-4" href={done ? "/training/certificates" : "/training/certificates?view=done"}>{done ? "Show waiting certificates" : "Show checked certificates"}</Link>
          </p>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState as="h2" icon="certificate" title={done ? "Nothing checked yet" : "Nothing waiting"} hint="Staff upload certificates in Turnfin Me. They appear here for the people you cover." />
      ) : (
        <ul className="module-list">
          {rows.map((row) => {
            const status = CERTIFICATE_STATUS_META[row.status as keyof typeof CERTIFICATE_STATUS_META];
            return (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-4 p-4 sm:px-5">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/training/people/${row.person.id}`} className="module-row-title underline-offset-4 hover:underline">{row.person.name}</Link>
                    {status ? <Tag meta={status} /> : null}
                  </div>
                  <p className="text-sm">{row.typeName || "Qualification not named"}{row.reference ? ` · ${row.reference}` : ""}</p>
                  <p className="text-xs text-ui-muted-foreground">
                    {[row.issuedOn ? `Issued ${formatDate(row.issuedOn)}` : null, row.expiresOn ? `expires ${formatDate(row.expiresOn)}` : null, `sent ${formatDateTime(row.createdAt)}`].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-sm"><a className="underline underline-offset-4" href={`/training/certificates/${row.id}/file`} target="_blank" rel="noopener noreferrer">Open {row.fileName}</a> <span className="text-ui-muted-foreground">({Math.ceil(row.size / 1024)} KB)</span></p>
                  {row.status !== "PENDING" ? <p className="text-xs text-ui-muted-foreground">{row.reviewedByName} · {row.reviewedAt ? formatDateTime(row.reviewedAt) : ""}{row.reviewNote ? ` · ${row.reviewNote}` : ""}</p> : null}
                </div>
                {row.status === "PENDING" ? (
                  <div className="flex flex-wrap gap-2">
                    <VerifyCertificate row={row} types={types} />
                    <DeclineCertificate id={row.id} name={row.person.name} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
