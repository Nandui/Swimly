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
import { cn } from "@/lib/utils";

import type { Metadata } from "next";

import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import {
  AddPerson,
  EditPerson,
  ResetPersonPassword,
  SetPersonActive,
} from "@/components/staff/person-actions";
import { plural } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import {
  STAFF_STATUS_META,
  permissionCountLabel,
  roleReach,
} from "@/lib/staff/constants";
import { expandPermissions } from "@/lib/staff/permissions";
import { listRolesForPicker, type RoleOption } from "@/lib/staff/data/roles";
import { listPeopleForDisplay, type Person } from "@/lib/staff/data/staff";
import { listPeopleOrg } from "@/lib/people/data";
import { staffColumnValues } from "@/modules/server";
import { AppIcon } from "@/components/ui-kit/app-icon";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage(props: PageProps<"/staff">) {
  const session = await screenPage("staff", "staff.manage");
  const params = await props.searchParams;

  const [people, roles, org] = await Promise.all([
    listPeopleForDisplay(),
    listRolesForPicker(),
    listPeopleOrg(),
  ]);
  const active = people.filter((p) => p.isActive);
  const inactive = people.filter((p) => !p.isActive);
  // Module columns (Aquatics adds "Classes") come through Core's contribution seam.
  const columns = await staffColumnValues(people.map((p) => p.id));
  const keyholders = active.filter((p) =>
    expandPermissions(p.staffRole?.permissions ?? []).has("staff.manage"),
  ).length;

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <PageHeader
        title="Staff"
        description="Who can sign in, and what each of them is allowed to change."
        actions={
          <>
            <Button variant="outline" asChild={true}>
              <UiLink href="/staff/details-requests">
                {<AppIcon name="clipboardList" size="sm" />}
                {"Details changes"}
              </UiLink>
            </Button>
            <Button variant="outline" asChild={true}>
              <UiLink href="/staff/devices">
                {<AppIcon name="monitor" size="sm" />}
                {"Work devices"}
              </UiLink>
            </Button>
            <Button variant="outline" asChild={true}>
              <UiLink href="/staff/organisation">
                {<AppIcon name="building" size="sm" />}
                {"Organisation"}
              </UiLink>
            </Button>
            <AddPerson roles={roles} defaultOpen={params.add === "1"} />
          </>
        }
      />

      {active.length === 0 ? (
        <EmptyState
          icon="users"
          title="Nobody can sign in yet"
          hint="Add the people who take attendance and run the desk. Give each of them the role that lets them do their job and no more."
          action={<AddPerson roles={roles} />}
        />
      ) : (
        <section className="pc-panel" aria-label="Staff">
          <p className="text-sm text-ui-muted-foreground">
            {plural(active.length, "person", "people")} can sign in, across {plural(roles.length, "role")}.{" "}
            {keyholders} of them can manage accounts. There is no sign-up and no invitation email.
          </p>
          <PeopleTable
            people={active}
            roles={roles}
            org={org}
            columns={columns}
            currentUserId={session.user.id}
          />
        </section>
      )}

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
            org={org}
            columns={columns}
            currentUserId={session.user.id}
          />
        </section>
      ) : null}
    </div>
  );
}

/** The avatar's initials, as `initials` in the shadcn avatar works them out. That one lives in a
 *  client module, so a server page cannot call it. */
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("");

function PeopleTable({
  people,
  roles,
  org,
  columns,
  currentUserId,
}: {
  people: Person[];
  roles: RoleOption[];
  org: Awaited<ReturnType<typeof listPeopleOrg>>;
  columns: Awaited<ReturnType<typeof staffColumnValues>>;
  currentUserId?: string;
}) {
  return (
    <Table className="w-full [&_td]:whitespace-normal [&_th]:whitespace-normal">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Person</TableHead>
          <TableHead scope="col" className={"max-lg:hidden"}>
            Role
          </TableHead>
          {columns.map((column) => (
            <TableHead key={column.id} scope="col" className={"max-lg:hidden"}>
              {column.header}
            </TableHead>
          ))}
          <TableHead scope="col">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {people.map((person) => {
          const permissions = person.staffRole?.permissions ?? [];
          const reach = roleReach(permissions);
          // On narrow screens each module value follows the role, e.g. "Classes 3"; a 0 is left out.
          const extras = columns.map((column) => {
            const value = column.values.get(person.id) ?? "0";
            return { id: column.id, header: column.header, value: value === "0" ? "" : value };
          });
          const o = org.get(person.id);
          const orgLine = [o?.jobTitle, o?.departments.join(", "), o?.manager ? `reports to ${o.manager}` : null].filter(Boolean).join(" · ");
          return (
            <TableRow key={person.id}>
              <TableCell>
                <div className="min-w-0 flex gap-3 items-center">
                  <UiLink href={`/staff/${person.id}`} className="min-w-0 flex gap-3 items-center rounded-[var(--pc-radius-card)] underline-offset-4 hover:[&_.pc-row-title]:underline">
                    <Avatar size="lg" aria-hidden="true" className="max-sm:hidden"><AvatarFallback>{initialsOf(person.name)}</AvatarFallback></Avatar>
                    <span className="min-w-0 flex flex-col">
                      <span className="pc-row-title inline-flex min-h-6 flex-wrap items-center gap-x-2">
                        {person.name}{person.id === currentUserId ? " (you)" : null}
                        {!person.hasPassword ? (
                          <Tag meta={STAFF_STATUS_META.noPassword} />
                        ) : null}
                      </span>
                      <span className="pc-row-hint block [overflow-wrap:anywhere]">
                        {person.email}
                      </span>
                      {orgLine ? <span className="pc-row-hint block">{orgLine}</span> : null}
                      <span className={cn("pc-row-hint block", "lg:hidden")}>
                        {[person.staffRole?.name ?? "No role", ...extras.filter((extra) => extra.value).map((extra) => `${extra.header} ${extra.value}`)].join(" · ")}
                      </span>
                    </span>
                  </UiLink>
                </div>
              </TableCell>
              <TableCell className={"max-lg:hidden"}>
                <span className="flex flex-col items-start gap-1">
                  <Tag meta={reach} label={person.staffRole?.name ?? "No role"} />
                  <span className="pc-row-hint">
                    {permissionCountLabel(permissions.length)}
                  </span>
                </span>
              </TableCell>
              {extras.map((extra) => (
                <TableCell key={extra.id} className={"max-lg:hidden"}>
                  <span className="tabular-nums">
                    {extra.value}
                  </span>
                </TableCell>
              ))}
              <TableCell>
                <div
                  className={
                    "min-w-0 flex gap-2 items-center justify-end flex-nowrap max-sm:flex-col"
                  }
                >
                  <ResetPersonPassword person={person} />
                  <EditPerson person={person} roles={roles} />
                  <SetPersonActive person={person} />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
