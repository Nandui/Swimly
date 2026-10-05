import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import UiLink from "next/link";
import { Building2, KeyRound } from "lucide-react";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/shadcn/item";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import {
  EditProfile, RecordQualification, RevokeQualification, SuperadminToggle, WorksAt,
} from "@/components/people/people-actions";
import { EditPerson } from "@/components/staff/person-actions";
import { formatDate } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import { PERSON_STATUS_META, QUALIFICATION_STATE_META } from "@/lib/people/constants";
import { getOrganisation, getPersonDetail, listPeopleOptions } from "@/lib/people/data";
import { listRolesForPicker } from "@/lib/staff/data/roles";
import { cleanLevels, describeLevels, levelsFromAccess } from "@/lib/staff/levels";

/** One read per request, shared by the page and its tab title. */
const loadPerson = cache(getPersonDetail);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await screenPage("staff", "staff.manage");
  const person = await loadPerson((await params).id);
  return { title: person?.name ?? "Page not found" };
}

/** One person's place in the organisation: where they work, who they report
 *  to, the roles they hold and where, and their qualifications. Account
 *  administration only; restricted (HR) records are never shown here. */
export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await screenPage("staff", "staff.manage");
  const { id } = await params;
  const [person, organisation, people, roles] = await Promise.all([
    loadPerson(id), getOrganisation(), listPeopleOptions(), listRolesForPicker(),
  ]);
  if (!person) notFound();
  const departments = organisation.departments.filter((d) => !d.archivedAt);
  const types = organisation.qualificationTypes.filter((t) => !t.archivedAt);
  const role = person.staffRole;
  const levels = role
    ? describeLevels(role.levels !== null ? cleanLevels(role.levels, role.extras) : levelsFromAccess(role.permissions, role.screens).role)
    : null;
  const liveSites = organisation.sites;
  const facts: [string, React.ReactNode][] = [
    ["Job title", person.jobTitle || "Not set"],
    ["Started", person.startedOn ? formatDate(new Date(`${person.startedOn}T00:00:00Z`)) : "Not set"],
    ["Date of birth", person.dateOfBirth ? formatDate(new Date(`${person.dateOfBirth}T00:00:00Z`)) : "Not set"],
    ["Main site", person.primaryClub?.name ?? "Not set"],
    ["Manager", person.manager ? <UiLink className="-my-3 inline-flex min-h-11 items-center underline underline-offset-4" href={`/staff/${person.manager.id}`}>{person.manager.name}</UiLink> : "No manager"],
    ["Departments", person.departments.length ? person.departments.map((d) => d.department.name + (d.isPrimary && person.departments.length > 1 ? " (main)" : "")).join(", ") : "None"],
  ];

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <PageHeader
        back={{ href: "/staff", label: "Staff" }}
        title={person.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="[overflow-wrap:anywhere]">{person.email}</span>
            {person.isSuperadmin ? <Tag meta={PERSON_STATUS_META.superadmin} /> : null}
            {!person.isActive ? <Tag meta={PERSON_STATUS_META.deactivated} /> : null}
          </span>
        }
        actions={
          <>
            {session.user.isSuperadmin && person.isActive ? <SuperadminToggle userId={person.id} name={person.name} value={person.isSuperadmin} /> : null}
            <EditProfile person={person} sites={organisation.sites} departments={departments} people={people} />
          </>
        }
      />

      <section aria-labelledby="profile-heading" className="pc-panel">
        <div className="pc-panel-head">
          <h2 id="profile-heading" className="text-lg font-semibold">Profile</h2>
        </div>
        <dl className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-semibold text-ui-muted-foreground">{label}</dt>
              <dd className="mt-1 [overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
        </dl>
        {person.reports.length ? (
          <p className="text-sm text-ui-muted-foreground">
            Manages {person.reports.map((r, i) => <span key={r.id}>{i ? ", " : ""}<UiLink className="-my-3 inline-flex min-h-11 items-center underline underline-offset-4" href={`/staff/${r.id}`}>{r.name}</UiLink></span>)}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="roles-heading" className="pc-panel">
        <div className="pc-panel-head">
          <h2 id="roles-heading" className="text-lg font-semibold">Role and sites</h2>
          {person.isActive ? (
            <div className="flex flex-wrap gap-2">
              <EditPerson person={person} roles={roles} label="Change role" />
              <WorksAt userId={person.id} name={person.name} sites={liveSites} current={person.worksAt.map((s) => s.id)} />
            </div>
          ) : null}
        </div>
        <ul className="pc-rows">
          <li className="pc-row">
            <span className="pc-tile-icon" aria-hidden="true"><KeyRound /></span>
            <div className="pc-row-body">
              <span className="pc-row-title">{role?.name ?? "No role"}</span>
              {levels ? <span className="pc-row-hint">{levels}</span> : null}
              {role?.levels === null ? <span className="pc-row-hint">Uses older permission settings · open it on Roles and save to switch to levels</span> : null}
            </div>
          </li>
          <li className="pc-row">
            <span className="pc-tile-icon" aria-hidden="true"><Building2 /></span>
            <div className="pc-row-body">
              <span className="pc-row-title">Works at</span>
              <span className="pc-row-hint">{person.worksAt.length ? person.worksAt.map((s) => s.name).join(", ") : "Every site"}</span>
            </div>
          </li>
        </ul>
        <p className="pc-row-hint">Swim school, Training and Rota apply at the sites they work at; everything else applies everywhere.</p>
      </section>

      <section aria-labelledby="qualifications-heading" className="pc-panel">
        <div className="pc-panel-head">
          <h2 id="qualifications-heading" className="text-lg font-semibold">Qualifications</h2>
          {types.length ? <RecordQualification userId={person.id} name={person.name} types={types} /> : null}
        </div>
        {person.qualifications.length === 0 ? (
          <EmptyState compact icon="award" title="No qualifications recorded" />
        ) : (
          <ItemGroup>
            {person.qualifications.map((q) => {
              const meta = QUALIFICATION_STATE_META[q.state];
              return (
                <Item key={q.id} role="listitem" className="items-start">
                  <ItemContent className="min-w-0">
                    <ItemTitle className="flex-wrap">
                      <span>{q.name}</span>
                      <Tag meta={meta} />
                    </ItemTitle>
                    <ItemDescription>
                      Issued {formatDate(new Date(`${q.issuedOn}T00:00:00Z`))}
                      {q.expiresOn ? ` · expires ${formatDate(new Date(`${q.expiresOn}T00:00:00Z`))}` : " · does not expire"}
                      {q.reference ? ` · ${q.reference}` : ""}
                      {q.verifiedBy ? ` · verified by ${q.verifiedBy}` : ""}
                    </ItemDescription>
                  </ItemContent>
                  {q.state !== "revoked" ? <ItemActions><RevokeQualification id={q.id} label={q.name} /></ItemActions> : null}
                </Item>
              );
            })}
          </ItemGroup>
        )}
      </section>
    </div>
  );
}
