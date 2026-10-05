import type { Metadata } from "next";
import Link from "next/link";
import { AssignTraining } from "@/components/training/manage-actions";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { QUALIFICATION_STATE_META } from "@/lib/people/constants";
import { formatDate } from "@/lib/format";
import { EXPIRY_WARNING_DAYS } from "@/lib/training/constants";
import { expiringQualifications } from "@/lib/training/data";

export const metadata: Metadata = { title: "Expiring qualifications" };

/** Qualifications that have expired or expire within the warning window, for
 *  the people this person covers, with the course that renews each. A newer
 *  certificate of the same type takes a person off the list. */
export default async function TrainingExpiringPage() {
  const { rows } = await expiringQualifications();
  return (
    <div className="space-y-6">
      <div className="module-heading">
        <div className="space-y-2">
          <h1>Expiring qualifications</h1>
          <p className="text-sm">Expired, or expiring in the next {EXPIRY_WARNING_DAYS} days. Assign the renewal course so it is done in time.</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState as="h2" icon="hourglass" title="Nothing expiring" hint={`Everyone you cover is in date for the next ${EXPIRY_WARNING_DAYS} days.`} />
      ) : (
        <ul className="module-list">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-start justify-between gap-4 p-4 sm:px-5">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/training/people/${row.userId}`} className="module-row-title underline-offset-4 hover:underline">{row.name}</Link>
                  <Tag meta={QUALIFICATION_STATE_META[row.state]} />
                </div>
                <p className="text-sm">{row.qualification}{row.jobTitle ? <span className="text-ui-muted-foreground"> · {row.jobTitle}</span> : null}</p>
                <p className="text-xs text-ui-muted-foreground">
                  {row.expiresOn ? `${row.state === "expired" ? "Expired" : "Expires"} ${formatDate(row.expiresOn)}` : ""}
                  {row.renewal ? ` · renewed by ${row.renewal.title}` : " · no course renews it yet; record the new certificate once they have it"}
                </p>
              </div>
              {row.renewal?.assigned ? <p className="text-sm text-ui-muted-foreground">Renewal assigned</p>
                : row.renewal?.canAssign ? <AssignTraining courses={[{ id: row.renewal.courseId, title: row.renewal.title }]} people={[{ id: row.userId, name: row.name, jobTitle: row.jobTitle }]} courseId={row.renewal.courseId} userIds={[row.userId]} label="Assign renewal" variant="outline" /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
