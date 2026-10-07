import type { Metadata } from "next";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { plural } from "@/lib/format";
import {
  ArchiveDepartment, SaveDepartment,
} from "@/components/people/people-actions";
import { can } from "@/lib/authz";
import { screenPage } from "@/lib/page-guards";
import { getOrganisation } from "@/lib/people/data";
import { ARCHIVAL_STATUS_META } from "@/lib/status";

export const metadata: Metadata = { title: "Departments" };

/** The departments people belong to and activities are planned by (Admin, People). One list for
 *  every module; kept with Admin: Manage, or Admin: Setup with its tick. Sites are under Sites. */
export default async function DepartmentsPage() {
  const session = await screenPage("departments", "setup.view");
  const canKeep = can(session, "setup.departments");
  const { organisation, sites, departments } = await getOrganisation();
  const liveDepartments = departments.filter((d) => !d.archivedAt);

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <PageHeader
        title="Departments"
        description={`The teams people at ${organisation?.name ?? "the organisation"} work in. Every activity on the rota belongs to one.`}
        actions={canKeep ? <SaveDepartment sites={sites} /> : undefined}
      />

      <section className="pc-panel" aria-labelledby="departments-heading">
        <div className="pc-panel-head">
          <h2 id="departments-heading" className="text-lg font-semibold">Departments</h2>
        </div>
        {departments.length === 0 ? (
          <EmptyState icon="users" title="No departments yet" hint="Add the teams people work in, such as Aquatics, Reception, Gym and Maintenance." action={canKeep ? <SaveDepartment sites={sites} /> : undefined} />
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
                      {canKeep ? <><SaveDepartment department={department} sites={sites} />
                      <ArchiveDepartment id={department.id} name={department.name} archived={!!department.archivedAt} /></> : null}
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
