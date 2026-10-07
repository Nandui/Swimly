import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import {
  ArchiveQualificationType, SaveQualificationType,
} from "@/components/people/people-actions";
import { can } from "@/lib/authz";
import { screenPage } from "@/lib/page-guards";
import { getOrganisation } from "@/lib/people/data";
import { ARCHIVAL_STATUS_META } from "@/lib/status";

export const metadata: Metadata = { title: "Qualifications" };

/** The qualifications staff can hold (Admin, Work): one list for every module. Training records
 *  who holds which; the rota's activities ask for them. Kept with Admin: Manage, or Admin: Setup
 *  with its tick. */
export default async function QualificationsPage() {
  const session = await screenPage("qualifications", "setup.view");
  const canKeep = can(session, "setup.qualifications");
  const { qualificationTypes } = await getOrganisation();

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <PageHeader title="Qualifications" description="The certificates staff can hold, and how long each usually lasts. Recording who holds one is in Training." />

      <section className="pc-panel" aria-labelledby="qualifications-heading">
        <div className="pc-panel-head">
          <h2 id="qualifications-heading" className="text-lg font-semibold">Qualifications</h2>
          {canKeep ? <SaveQualificationType /> : null}
        </div>
        {qualificationTypes.length === 0 ? (
          <EmptyState compact icon="award" title="No qualifications yet" hint="Add the certificates staff can hold, such as a lifeguard or first aid qualification." />
        ) : (
          <>
            <p className="text-sm text-ui-muted-foreground">The certificates staff can hold.</p>
            <ul className="pc-rows">
              {qualificationTypes.map((type) => (
                <li key={type.id} className="pc-row">
                  <span className="pc-tile-icon" aria-hidden="true"><GraduationCap /></span>
                  <div className="pc-row-body">
                    <span className="pc-row-title flex flex-wrap items-center gap-x-2">
                      {type.name}
                      {type.archivedAt ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : null}
                    </span>
                    <span className="pc-row-hint">
                      {type.validityMonths ? `Usually valid for ${type.validityMonths} months` : "Does not expire"} · {type._count.qualifications} held
                    </span>
                  </div>
                  <div className="pc-row-trail">
                    <div className="flex flex-nowrap gap-2">
                      {canKeep ? <><SaveQualificationType type={type} />
                      <ArchiveQualificationType id={type.id} name={type.name} archived={!!type.archivedAt} /></> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
