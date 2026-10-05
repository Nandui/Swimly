import type { Metadata } from "next";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/shadcn/item";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import {
  ArchiveDepartment, ArchiveQualificationType, SaveDepartment, SaveQualificationType,
} from "@/components/people/people-actions";
import { screenPage } from "@/lib/page-guards";
import { getOrganisation } from "@/lib/people/data";
import { ARCHIVAL_STATUS_META } from "@/lib/status";

export const metadata: Metadata = { title: "Organisation" };

/** One organisation chart for every module: departments and the
 *  qualifications staff can hold. Sites are managed under Clubs. */
export default async function OrganisationPage() {
  await screenPage("staff", "staff.manage");
  const { organisation, sites, departments, qualificationTypes } = await getOrganisation();
  const liveDepartments = departments.filter((d) => !d.archivedAt);

  return (
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader
        back={{ href: "/staff", label: "Staff" }}
        title="Organisation"
        description={`How ${organisation?.name ?? "the organisation"} is arranged: the departments people belong to and the qualifications they hold.`}
        actions={<SaveDepartment sites={sites} />}
      />

      <section className="pc-panel" aria-labelledby="departments-heading">
        <h2 id="departments-heading" className="text-xl font-semibold">Departments</h2>
        <Lead>
          <Num>{liveDepartments.length}</Num> {liveDepartments.length === 1 ? "department" : "departments"}. They organise people; they do not
          give anyone access. What a role can do applies at the sites each person works at.
        </Lead>
        {departments.length === 0 ? (
          <EmptyState icon="users" title="No departments yet" hint="Add the teams people work in, such as Aquatics, Reception, Gym and Maintenance." action={<SaveDepartment sites={sites} />} />
        ) : (
          <ItemGroup className="divide-y divide-ui-border">
            {departments.map((department) => (
              <Item key={department.id} role="listitem" className="items-start">
                <ItemContent className="min-w-0">
                  <ItemTitle className="min-w-0 flex-wrap">
                    <span>{department.name}</span>
                    {department.archivedAt ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : null}
                  </ItemTitle>
                  <ItemDescription>
                    {department.club?.name ?? "Every site"} · {department._count.members} {department._count.members === 1 ? "person" : "people"}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <div className="min-w-0 flex gap-1 items-center">
                    <SaveDepartment department={department} sites={sites} />
                    <ArchiveDepartment id={department.id} name={department.name} archived={!!department.archivedAt} />
                  </div>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </section>

      <section className="pc-panel" aria-labelledby="qualifications-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="qualifications-heading" className="text-xl font-semibold">Qualifications</h2>
          <SaveQualificationType />
        </div>
        <Lead>
          The certificates staff can hold. Training records them when a course or sign-off is completed; the rota warns when
          someone rostered has one that has expired.
        </Lead>
        <ItemGroup className="divide-y divide-ui-border">
          {qualificationTypes.map((type) => (
            <Item key={type.id} role="listitem" className="items-start">
              <ItemContent className="min-w-0">
                <ItemTitle className="min-w-0 flex-wrap">
                  <span>{type.name}</span>
                  {type.archivedAt ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : null}
                </ItemTitle>
                <ItemDescription>
                  {type.validityMonths ? `Usually valid for ${type.validityMonths} months` : "Does not expire"} · {type._count.qualifications} held
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <div className="min-w-0 flex gap-1 items-center">
                  <SaveQualificationType type={type} />
                  <ArchiveQualificationType id={type.id} name={type.name} archived={!!type.archivedAt} />
                </div>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </section>
    </div>
  );
}
