import { Button } from "@/components/shadcn/button";
import UiLink from "next/link";
import {
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
  TableBody,
  Table,
} from "@/components/shadcn/table";

import type { Metadata } from "next";

import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import {
  AddPerson,
  EditPerson,
  ResetPersonPassword,
  SetPersonActive,
} from "@/components/staff/person-actions";
import { nameInitials, plural } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import {
  STAFF_STATUS_META,
  permissionCountLabel,
  roleReach,
} from "@/lib/staff/constants";
import { expandPermissions } from "@/lib/staff/permissions";
import { listRolesForPicker, type RoleOption } from "@/lib/staff/data/roles";
import { listPeopleForDisplay, type Person } from "@/lib/staff/data/staff";
import { AppIcon } from "@/components/ui-kit/app-icon";
import { StaffFilterBar, type StaffFilterPicker } from "@/components/staff/staff-filters";
import { prisma } from "@/lib/prisma";
import {
  STAFF_SHOW,
  countBy,
  filterPeople,
  filtersChosen,
  readStaffFilters,
  staffFiltersQuery,
  type FilterablePerson,
  type StaffShow,
} from "@/lib/staff/filters";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage(props: PageProps<"/staff">) {
  const session = await screenPage("staff", "staff.manage");
  const params = await props.searchParams;

  const orgId = session.user.orgId ?? undefined;
  const [everyone, roles, sites, departments] = await Promise.all([
    listPeopleForDisplay(),
    listRolesForPicker(),
    prisma.club.findMany({ where: { orgId, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.department.findMany({ where: { orgId, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const filters = readStaffFilters(params);
  const people: FilterRow[] = everyone.map((person) => ({ ...person, departmentIds: person.departments.map((d) => d.departmentId) }));
  const shown = filterPeople(people, filters);
  const active = shown.filter((p) => p.isActive);
  const inactive = shown.filter((p) => !p.isActive);
  const allActive = people.filter((p) => p.isActive);
  const keyholders = allActive.filter((p) =>
    expandPermissions(p.staffRole?.permissions ?? []).has("staff.manage"),
  ).length;
  // Each person's link carries the list as it is, so their page's back link returns to it.
  const back = staffFiltersQuery(filters);
  const personHref = (id: string) => (back ? `/staff/${id}?back=${encodeURIComponent(back)}` : `/staff/${id}`);

  const byShow = countBy(people, filters, "show", (p) => ["all", p.isActive ? "active" : "inactive"]);
  const showCounts = Object.fromEntries((Object.keys(STAFF_SHOW) as StaffShow[]).map((key) => [key, byShow.get(key) ?? 0])) as Record<StaffShow, number>;
  const allSiteIds = sites.map((s) => s.id);
  const byRole = countBy(people, filters, "role", (p) => (p.staffRoleId ? [p.staffRoleId] : []));
  const bySite = countBy(people, filters, "site", (p) => (p.siteIds.length ? p.siteIds : allSiteIds));
  const byDepartment = countBy(people, filters, "department", (p) => p.departmentIds);
  const pickers: StaffFilterPicker[] = [
    { key: "role" as const, label: "Role", all: "All roles", options: roles.map((r) => ({ value: r.id, label: r.name, count: byRole.get(r.id) ?? 0 })) },
    { key: "site" as const, label: "Works at", all: "All sites", options: sites.map((s) => ({ value: s.id, label: s.name, count: bySite.get(s.id) ?? 0 })) },
    { key: "department" as const, label: "Department", all: "All departments", options: departments.map((d) => ({ value: d.id, label: d.name, count: byDepartment.get(d.id) ?? 0 })) },
  ].filter((picker) => picker.options.length > 1 || filters[picker.key]);
  const filtering = filtersChosen(filters);

  return (
    <PageShell header={<PageHeader
        title="Staff"
        description="Who can sign in, and what each of them is allowed to change."
        actions={
          <>
            <Button variant="outline" asChild={true}>
              <UiLink href="/staff/devices">
                {<AppIcon name="monitor" size="sm" />}
                {"Work devices"}
              </UiLink>
            </Button>
            <AddPerson roles={roles} defaultOpen={params.add === "1"} />
          </>
        }
      />}>

      {people.length > 0 ? (
        <StaffFilterBar filters={filters} showCounts={showCounts} pickers={pickers} shown={shown.length} total={people.length} />
      ) : null}

      {filtering && shown.length === 0 ? (
        <EmptyState
          icon="searchX"
          title="Nobody matches"
          hint="Check the spelling, or clear the search and filters to see everyone."
          action={<Button asChild variant="outline"><UiLink href="/staff">Clear all</UiLink></Button>}
        />
      ) : allActive.length === 0 ? (
        <EmptyState
          icon="users"
          title="Nobody can sign in yet"
          hint="Add the people who take attendance and run the desk. Give each of them the role that lets them do their job and no more."
          action={<AddPerson roles={roles} />}
        />
      ) : active.length > 0 ? (
        filtering ? (
          <section className="pc-panel" aria-labelledby="staff-can-sign-in">
            <div className="pc-panel-head">
              <h2 id="staff-can-sign-in" className="text-lg font-semibold">Can sign in</h2>
            </div>
            <PeopleTable people={active} roles={roles} currentUserId={session.user.id} personHref={personHref} />
          </section>
        ) : (
          <section className="pc-panel" aria-label="Staff">
            <p className="text-sm text-ui-muted-foreground">
              {plural(allActive.length, "person", "people")} can sign in, across {plural(roles.length, "role")}.{" "}
              {keyholders} of them can manage accounts. There is no sign-up and no invitation email.
            </p>
            <PeopleTable people={active} roles={roles} currentUserId={session.user.id} personHref={personHref} />
          </section>
        )
      ) : null}

      {inactive.length > 0 ? (
        <section className="pc-panel" aria-labelledby="staff-deactivated">
          <div className="pc-panel-head">
            <h2 id="staff-deactivated" className="text-lg font-semibold">Deactivated</h2>
          </div>
          <p className="text-sm text-ui-muted-foreground">
            They cannot sign in. Everything they recorded is still readable.
          </p>
          <PeopleTable
            people={inactive}
            roles={roles}
            currentUserId={session.user.id}
            personHref={personHref}
          />
        </section>
      ) : null}
    </PageShell>
  );
}


function PersonActions({ person, roles }: { person: Person; roles: RoleOption[] }) {
  return (
    <>
      <ResetPersonPassword person={person} />
      <EditPerson person={person} roles={roles} />
      <SetPersonActive person={person} />
    </>
  );
}

type FilterRow = Person & FilterablePerson;

function PeopleTable({
  people,
  roles,
  currentUserId,
  personHref,
}: {
  people: Person[];
  roles: RoleOption[];
  currentUserId?: string;
  personHref: (id: string) => string;
}) {
  return (
    <Table className="w-full [&_td]:whitespace-normal [&_th]:whitespace-normal">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Person</TableHead>
          <TableHead scope="col" className={"max-lg:hidden"}>
            Role
          </TableHead>
          <TableHead scope="col" className="max-md:hidden">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {people.map((person) => {
          const permissions = person.staffRole?.permissions ?? [];
          const reach = roleReach(permissions);
          return (
            <TableRow key={person.id}>
              <TableCell>
                <div className="min-w-0 flex gap-3 items-center">
                  <UiLink href={personHref(person.id)} className="min-w-0 flex gap-3 items-center rounded-card underline-offset-4 hover:[&_.pc-row-title]:underline">
                    <Avatar size="lg" aria-hidden="true"><AvatarFallback>{nameInitials(person.name)}</AvatarFallback></Avatar>
                    <span className="min-w-0 flex flex-col">
                      <span className="pc-row-title inline-flex min-h-6 flex-wrap items-center gap-x-2">
                        {person.name}{person.id === currentUserId ? " (you)" : null}
                        {!person.hasPassword ? (
                          <Tag meta={STAFF_STATUS_META.noPassword} />
                        ) : null}
                      </span>
                      <span className="pc-row-hint block wrap-anywhere">
                        {person.email}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 lg:hidden">
                        <Tag meta={reach} label={person.staffRole?.name ?? "No role"} />
                      </span>
                    </span>
                  </UiLink>
                </div>
                {/* Phones: the actions move under the person, in one line. */}
                <div className="mt-3 flex flex-wrap gap-2 md:hidden">
                  <PersonActions person={person} roles={roles} />
                </div>
              </TableCell>
              {/* max-md:hidden too, so the phone row card closes on the person cell (poolside.css). */}
              <TableCell className="max-md:hidden max-lg:hidden">
                <span className="flex flex-col items-start gap-1">
                  <Tag meta={reach} label={person.staffRole?.name ?? "No role"} />
                  <span className="pc-row-hint">
                    {permissionCountLabel(permissions.length)}
                  </span>
                </span>
              </TableCell>
              <TableCell className="max-md:hidden">
                <div className="min-w-0 flex gap-2 items-center justify-end flex-nowrap">
                  <PersonActions person={person} roles={roles} />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
