import type { Metadata } from "next";
import { GraduationCap, Users } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { plural } from "@/lib/format";
import {
  ArchiveDepartment, ArchiveQualificationType, SaveDepartment, SaveQualificationType,
} from "@/components/people/people-actions";
import { screenPage } from "@/lib/page-guards";
import { getOrganisation } from "@/lib/people/data";
import { ARCHIVAL_STATUS_META } from "@/lib/status";

export const metadata: Metadata = { title: "Organisation" };

/** One organisation chart for every module: departments and the
 *  qualifications staff can hold. Sites are managed under Sites (/clubs). */
export default async function OrganisationPage() {
  await screenPage("staff", "staff.manage");
  const { organisation, sites, departments, qualificationTypes } = await getOrganisation();
  const liveDepartments = departments.filter((d) => !d.archivedAt);

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <PageHeader
        back={{ href: "/staff", label: "Staff" }}
        title="Organisation"
        description={`How ${organisation?.name ?? "the organisation"} is arranged: the departments people belong to and the qualifications they hold.`}
        actions={<SaveDepartment sites={sites} />}
      />

      <section className="pc-panel" aria-labelledby="departments-heading">
        <div className="pc-panel-head">
          <h2 id="departments-heading" className="text-lg font-semibold">Departments</h2>
        </div>
        {departments.length === 0 ? (
          <EmptyState icon="users" title="No departments yet" hint="Add the teams people work in, such as Aquatics, Reception, Gym and Maintenance." action={<SaveDepartment sites={sites} />} />
        ) : (
          <>
            <p className="text-sm text-ui-muted-foreground">
              {plural(liveDepartments.length, "department")}. They organise people; they do not give anyone access.
            </p>
            <ul className="pc-rows">
              {departments.map((department) => (
                <li key={department.id} className="pc-row">
                  <span className="pc-tile-icon" aria-hidden="true"><Users /></span>
                  <div className="pc-row-body">
                    <span className="pc-row-title flex flex-wrap items-center gap-x-2">
                      {department.name}
                      {department.archivedAt ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : null}
                    </span>
                    <span className="pc-row-hint">
                      {department.club?.name ?? "Every site"} · {plural(department._count.members, "person", "people")}
                    </span>
                  </div>
                  <div className="pc-row-trail">
                    <div className="flex flex-nowrap gap-2">
                      <SaveDepartment department={department} sites={sites} />
                      <ArchiveDepartment id={department.id} name={department.name} archived={!!department.archivedAt} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="pc-panel" aria-labelledby="qualifications-heading">
        <div className="pc-panel-head">
          <h2 id="qualifications-heading" className="text-lg font-semibold">Qualifications</h2>
          <SaveQualificationType />
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
                      <SaveQualificationType type={type} />
                      <ArchiveQualificationType id={type.id} name={type.name} archived={!!type.archivedAt} />
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
