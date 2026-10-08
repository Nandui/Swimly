import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import UiLink from "next/link";
import { Award, Building2, KeyRound } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/shadcn/item";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import {
  EditEmployment, EditProfile, SuperadminToggle, WorksAt,
} from "@/components/people/people-actions";
import { EditPerson } from "@/components/staff/person-actions";
import { canSee } from "@/lib/authz";
import { formatDate, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { screenPage } from "@/lib/page-guards";
import { CONTRACT_META, PERSON_STATUS_META, QUALIFICATION_STATE_META, hoursOf, type ContractType } from "@/lib/people/constants";
import { REQUIREMENT_META, requirementStates, requirementSummary } from "@/lib/people/requirements";
import { profileSummary } from "@/modules/server";
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
  const [person, organisation, people, roles, positions] = await Promise.all([
    loadPerson(id), getOrganisation(), listPeopleOptions(), listRolesForPicker(),
    prisma.position.findMany({ where: { orgId: session.user.orgId ?? undefined }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, archivedAt: true } }),
  ]);
  if (!person) notFound();
  // What their position needs, and whether they hold it in date.
  const requirements = requirementStates(person.position?.requires.map((r) => r.type) ?? [], person.qualificationRecords, today());
  const summaries = person.orgId ? await profileSummary(person.id, person.orgId) : [];
  const canHr = canSee(session, "hr");
  const departments = organisation.departments.filter((d) => !d.archivedAt);
  const role = person.staffRole;
  const levels = role
    ? describeLevels(role.levels !== null ? cleanLevels(role.levels, role.extras) : levelsFromAccess(role.permissions, role.screens).role)
    : null;
  const liveSites = organisation.sites;
  const facts: [string, React.ReactNode][] = [
    ["Position", person.position ? `${person.position.name}${person.position.archivedAt ? " (archived)" : ""}` : person.jobTitle ? `${person.jobTitle} (not on the list)` : "Not set"],
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
            <EditEmployment person={{ ...person, endedOn: person.endedOn?.toISOString().slice(0, 10) ?? "" }} />
            <EditProfile person={person} sites={organisation.sites} departments={departments} people={people}
              positions={positions.filter((p) => !p.archivedAt || p.id === person.positionId).map(({ id, name }) => ({ id, name }))} />
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

      <div className="pc-grid">
        <section aria-labelledby="employment-heading" className="pc-panel">
          <div className="pc-panel-head"><h2 id="employment-heading" className="text-lg font-semibold">Employment</h2></div>
          <Facts items={[
            ["Contract", person.contractType ? CONTRACT_META[person.contractType as ContractType]?.label ?? person.contractType : "Not set"],
            ["Hours a week", person.contractMinutes != null ? hoursOf(person.contractMinutes) : "Not set"],
            ["Payroll number", person.payrollNumber || "Not set"],
            ["Last day", person.endedOn ? formatDate(person.endedOn) : "Still here"],
          ]} />
        </section>
        <section aria-labelledby="contact-heading" className="pc-panel">
          <div className="pc-panel-head">
            <div className="flex flex-col gap-1"><h2 id="contact-heading" className="text-lg font-semibold">Contact</h2><p className="pc-row-hint">Kept by them in Turnfin Me; changes come to Details requests.</p></div>
          </div>
          <Facts items={[
            ["Phone", person.phone || "Not given"],
            ["Home address", person.homeAddress || "Not given"],
            ["Emergency contact", person.emergencyName ? [person.emergencyName, person.emergencyRelationship, person.emergencyPhone].filter(Boolean).join(" · ") : "Not given"],
          ]} />
        </section>
      </div>

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
          <div className="flex flex-col gap-1">
            <h2 id="qualifications-heading" className="text-lg font-semibold">Qualifications</h2>
            <p className="pc-row-hint">{person.position ? `${person.position.name}: ${requirementSummary(requirements)}.` : "Set their position to see what it needs."} Recorded on their HR file and in Training.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canHr ? <Button asChild variant="outline"><UiLink href={`/hr/people/${person.id}`}>HR file</UiLink></Button> : null}
            <Button asChild variant="outline"><UiLink href={`/training/people/${person.id}`}>Training</UiLink></Button>
          </div>
        </div>
        {requirements.length ? (
          <ul className="pc-rows" aria-label="What their position needs">
            {requirements.map((r) => (
              <li key={r.typeId} className="pc-row">
                <span className="pc-tile-icon" aria-hidden="true"><Award /></span>
                <span className="pc-row-body"><span className="pc-row-title">{r.name}</span><span className="pc-row-hint">{r.expiresOn ? `Expires ${formatDate(new Date(`${r.expiresOn}T00:00:00Z`))}` : r.state === "missing" ? "Needed for their position" : "Does not expire"}</span></span>
                <span className="pc-row-trail"><Tag meta={REQUIREMENT_META[r.state]} /></span>
              </li>
            ))}
          </ul>
        ) : null}
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
                </Item>
              );
            })}
          </ItemGroup>
        )}
      </section>

      {summaries.length ? (
        <div className="pc-grid">
          {summaries.map((section) => (
            <section key={section.id} aria-labelledby={`summary-${section.id}`} className="pc-panel">
              <div className="pc-panel-head">
                <div className="flex flex-col gap-1"><h2 id={`summary-${section.id}`} className="text-lg font-semibold">{section.heading}</h2><p className="pc-row-hint">{section.summary}</p></div>
                {section.href ? <Button asChild variant="ghost"><UiLink href={section.href}>Open</UiLink></Button> : null}
              </div>
              {section.lines.length ? (
                <ul className="pc-rows">
                  {section.lines.map((line, i) => <li key={i} className="pc-row"><span className="pc-row-body"><span className="pc-row-title">{line.label}</span>{line.hint ? <span className="pc-row-hint">{line.hint}</span> : null}</span></li>)}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-semibold text-ui-muted-foreground">{label}</dt>
          <dd className="mt-1 [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
