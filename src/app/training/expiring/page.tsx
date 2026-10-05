import type { Metadata } from "next";
import Link from "next/link";
import { AssignTraining } from "@/components/training/manage-actions";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { QUALIFICATION_STATE_META } from "@/lib/people/constants";
import { formatDate, nameInitials } from "@/lib/format";
import { EXPIRY_WARNING_DAYS } from "@/lib/training/constants";
import { expiringQualifications } from "@/lib/training/data";

export const metadata: Metadata = { title: "Expiring qualifications" };

/** Qualifications that have expired or expire within the warning window, for
 *  the people this person covers, with the course that renews each. A newer
 *  certificate of the same type takes a person off the list. */
export default async function TrainingExpiringPage() {
  const { rows } = await expiringQualifications();
  return (
    <>
      <PageHeader title="Expiring qualifications" description={`Expired, or expiring in the next ${EXPIRY_WARNING_DAYS} days. Assign the renewal course so it is done in time.`} />
      {rows.length === 0 ? (
        <EmptyState as="h2" icon="hourglass" title="Nothing expiring" hint={`Everyone you cover is in date for the next ${EXPIRY_WARNING_DAYS} days.`} />
      ) : (
        <section className="pc-panel" aria-label="Expiring qualifications">
          <ul className="pc-rows">
            {rows.map((row) => (
              <li key={row.id} className="pc-row">
                <Avatar size="lg" aria-hidden="true"><AvatarFallback>{nameInitials(row.name)}</AvatarFallback></Avatar>
                <div className="pc-row-body">
                  <Link href={`/training/people/${row.userId}`} className="pc-row-title -my-3 inline-flex min-h-11 items-center self-start underline-offset-4 hover:underline">{row.name}</Link>
                  <p className="pc-row-hint">
                    {[
                      row.qualification,
                      row.jobTitle,
                      row.expiresOn ? `${row.state === "expired" ? "Expired" : "Expires"} ${formatDate(row.expiresOn)}` : null,
                      row.renewal ? `renewed by ${row.renewal.title}` : "no course renews it yet; record the new certificate once they have it",
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="pc-row-trail">
                  <Tag meta={QUALIFICATION_STATE_META[row.state]} />
                  {row.renewal?.assigned ? <span className="text-xs text-ui-muted-foreground">Renewal assigned</span>
                    : row.renewal?.canAssign ? <AssignTraining courses={[{ id: row.renewal.courseId, title: row.renewal.title }]} people={[{ id: row.userId, name: row.name, jobTitle: row.jobTitle }]} courseId={row.renewal.courseId} userIds={[row.userId]} label="Assign renewal" variant="outline" /> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
