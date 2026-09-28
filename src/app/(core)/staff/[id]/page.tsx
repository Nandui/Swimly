import type { Metadata } from "next";
import { notFound } from "next/navigation";
import UiLink from "next/link";
import { Item, ItemActions, ItemContent, ItemGroup } from "@/components/shadcn/item";
import { BackLink } from "@/components/ui-kit/back-link";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import {
  EditProfile, RecordQualification, RevokeQualification, SuperadminToggle, WorksAt,
} from "@/components/people/people-actions";
import { formatDate } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import { PERSON_STATUS_META, QUALIFICATION_STATE_META } from "@/lib/people/constants";
import { getOrganisation, getPersonDetail, listPeopleOptions } from "@/lib/people/data";
import { cleanLevels, describeLevels, levelsFromAccess } from "@/lib/staff/levels";

export const metadata: Metadata = { title: "Person" };

/** One person's place in the organisation: where they work, who they report
 *  to, the roles they hold and where, and their qualifications. Account
 *  administration only; restricted (HR) records are never shown here. */
export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await screenPage("staff", "staff.manage");
  const { id } = await params;
  const [person, organisation, people] = await Promise.all([
    getPersonDetail(id), getOrganisation(), listPeopleOptions(),
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
    ["Main site", person.primaryClub?.name ?? "Not set"],
    ["Manager", person.manager ? <UiLink className="underline underline-offset-4" href={`/staff/${person.manager.id}`}>{person.manager.name}</UiLink> : "No manager"],
    ["Departments", person.departments.length ? person.departments.map((d) => d.department.name + (d.isPrimary && person.departments.length > 1 ? " (main)" : "")).join(", ") : "None"],
  ];

  return (
    <div className="min-w-0 flex flex-col gap-6">
      <BackLink href="/staff" current={person.name}>Staff</BackLink>
      <PageHeader
        title={person.name}
        description={person.email}
        actions={
          <>
            {session.user.isSuperadmin && person.isActive ? <SuperadminToggle userId={person.id} name={person.name} value={person.isSuperadmin} /> : null}
            <EditProfile person={person} sites={organisation.sites} departments={departments} people={people} />
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        {person.isSuperadmin ? <Tag color={PERSON_STATUS_META.superadmin.color}>{PERSON_STATUS_META.superadmin.label}</Tag> : null}
        {!person.isActive ? <Tag color={PERSON_STATUS_META.deactivated.color}>{PERSON_STATUS_META.deactivated.label}</Tag> : null}
      </div>

      <section aria-labelledby="profile-heading" className="min-w-0 flex flex-col gap-3">
        <h2 id="profile-heading" className="text-xl font-semibold tracking-tight">Profile</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-sm text-ui-muted-foreground">{label}</dt>
              <dd className="mt-1 text-sm [overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
        </dl>
        {person.reports.length ? (
          <p className="text-sm text-ui-muted-foreground">
            Manages {person.reports.map((r, i) => <span key={r.id}>{i ? ", " : ""}<UiLink className="underline underline-offset-4" href={`/staff/${r.id}`}>{r.name}</UiLink></span>)}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="roles-heading" className="min-w-0 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="roles-heading" className="text-xl font-semibold tracking-tight">Role and sites</h2>
          {person.isActive ? <WorksAt userId={person.id} name={person.name} sites={liveSites} current={person.worksAt.map((s) => s.id)} /> : null}
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-sm text-ui-muted-foreground">Role</dt>
            <dd className="mt-1 text-sm">
              <span className="font-medium">{role?.name ?? "No role"}</span>
              {levels ? <span className="block text-ui-muted-foreground">{levels}{role?.levels === null ? " (proposed; the role keeps its old settings until it is saved on Roles)" : ""}</span> : null}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm text-ui-muted-foreground">Works at</dt>
            <dd className="mt-1 text-sm">{person.worksAt.length ? person.worksAt.map((s) => s.name).join(", ") : "Every site"}</dd>
          </div>
        </dl>
        <p className="text-sm text-ui-muted-foreground">Change their role on the Staff list. Swim school, Training and Rota apply at the sites they work at; everything else applies everywhere.</p>
      </section>

      <section aria-labelledby="qualifications-heading" className="min-w-0 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="qualifications-heading" className="text-xl font-semibold tracking-tight">Qualifications</h2>
          {types.length ? <RecordQualification userId={person.id} name={person.name} types={types} /> : null}
        </div>
        {person.qualifications.length === 0 ? (
          <p className="text-sm text-ui-muted-foreground">No qualifications recorded.</p>
        ) : (
          <ItemGroup className="divide-y divide-ui-border">
            {person.qualifications.map((q) => {
              const meta = QUALIFICATION_STATE_META[q.state];
              return (
                <Item key={q.id} role="listitem" className="items-start">
                  <ItemContent className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{q.name}</span>
                      <Tag color={meta.color}>{meta.label}</Tag>
                    </div>
                    <span className="text-sm text-ui-muted-foreground">
                      Issued {formatDate(new Date(`${q.issuedOn}T00:00:00Z`))}
                      {q.expiresOn ? ` · expires ${formatDate(new Date(`${q.expiresOn}T00:00:00Z`))}` : " · does not expire"}
                      {q.reference ? ` · ${q.reference}` : ""}
                      {q.verifiedBy ? ` · verified by ${q.verifiedBy}` : ""}
                    </span>
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
