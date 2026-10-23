import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import UiLink from "next/link";
import { Building2, KeyRound, LogIn } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import { SuperadminToggle, SystemActorToggle, WorksAt } from "@/components/people/people-actions";
import { EditPerson, ResetPersonPassword, SetPersonActive } from "@/components/staff/person-actions";
import { canSee } from "@/lib/authz";
import { formatDateTime } from "@/lib/format";
import { googleSignInAvailable } from "@/lib/google-sign-in";
import { prisma } from "@/lib/prisma";
import { screenPage } from "@/lib/page-guards";
import { PERSON_STATUS_META } from "@/lib/people/constants";
import { STAFF_STATUS_META } from "@/lib/staff/constants";
import { getPersonDetail } from "@/lib/people/data";
import { listRolesForPicker } from "@/lib/staff/data/roles";
import { staffBackHref } from "@/lib/staff/filters";
import { cleanLevels, describeLevels, levelsFromAccess } from "@/lib/staff/levels";

/** One read per request, shared by the page and its tab title. */
const loadPerson = cache(getPersonDetail);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await screenPage("staff", "staff.manage");
  const person = await loadPerson((await params).id);
  return { title: person?.name ?? "Page not found" };
}

/** One person's access to Turnfin: their sign-in, the role they hold and the
 *  sites it applies at. Account administration only. Their details (position,
 *  employment, contact, qualifications) are HR's, on their HR file
 *  (owner decision, 8 October 2026). */
export default async function PersonPage({ params, searchParams }: PageProps<"/staff/[id]">) {
  const session = await screenPage("staff", "staff.manage");
  const { id } = await params;
  // Back to the Staff list as it was left: its search and filters ride along in `back`.
  const backHref = staffBackHref((await searchParams).back);
  const [person, roles, sites] = await Promise.all([
    loadPerson(id), listRolesForPicker(),
    prisma.club.findMany({ where: { orgId: session.user.orgId ?? undefined, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  if (!person) notFound();
  const google = googleSignInAvailable();
  const role = person.staffRole;
  const levels = role
    ? describeLevels(role.levels !== null ? cleanLevels(role.levels, role.extras) : levelsFromAccess(role.permissions, role.screens).role)
    : null;

  return (
    <PageShell header={<PageHeader
        back={{ href: backHref, label: "Staff" }}
        title={person.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="wrap-anywhere">{person.email}</span>
            {person.isSuperadmin ? <Tag meta={PERSON_STATUS_META.superadmin} /> : null}
            {person.actsAsSystem ? <Tag meta={PERSON_STATUS_META.system} /> : null}
            {!person.isActive ? <Tag meta={PERSON_STATUS_META.deactivated} /> : null}
            {!person.hasPassword && (!google || person.isSuperadmin) ? <Tag meta={STAFF_STATUS_META.noPassword} /> : null}
          </span>
        }
        actions={
          <>
            {canSee(session, "hr") ? <Button asChild variant="ghost"><UiLink href={`/hr/people/${person.id}`}>HR file</UiLink></Button> : null}
            {session.user.isSuperadmin && person.isActive ? <SuperadminToggle userId={person.id} name={person.name} value={person.isSuperadmin} /> : null}
            {session.user.isSuperadmin ? <SystemActorToggle userId={person.id} name={person.name} value={person.actsAsSystem} /> : null}
            <ResetPersonPassword person={person} google={google} />
            <SetPersonActive person={person} />
          </>
        }
      />}>

      <section aria-labelledby="roles-heading" className="pc-panel">
        <div className="pc-panel-head">
          <h2 id="roles-heading" className="text-lg font-semibold">Role and sites</h2>
          {person.isActive ? (
            <div className="flex flex-wrap gap-2">
              <EditPerson person={person} roles={roles} label="Change role" />
              <WorksAt userId={person.id} name={person.name} sites={sites} current={person.worksAt.map((s) => s.id)} />
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
            <span className="pc-tile-icon" aria-hidden="true"><LogIn /></span>
            <div className="pc-row-body">
              <span className="pc-row-title">{person.usesGoogle ? "Signs in with Google" : google && !person.isSuperadmin ? "Has not signed in with Google yet" : "Signs in with a password"}</span>
              <span className="pc-row-hint">{person.lastSignInAt ? `Last signed in ${formatDateTime(person.lastSignInAt)}` : "No sign-in recorded yet"}</span>
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
    </PageShell>
  );
}
