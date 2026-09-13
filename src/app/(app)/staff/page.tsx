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

import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import {
  AddPerson,
  EditPerson,
  ResetPersonPassword,
  SetPersonActive,
} from "@/components/staff/person-actions";
import { can } from "@/lib/authz";
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

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const session = await screenPage("staff", "staff.manage");

  const [people, roles] = await Promise.all([
    listPeopleForDisplay(),
    listRolesForPicker(),
  ]);
  const active = people.filter((p) => p.isActive);
  const inactive = people.filter((p) => !p.isActive);
  const keyholders = active.filter((p) =>
    expandPermissions(p.staffRole?.permissions ?? []).has("staff.manage"),
  ).length;

  return (
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader
        title="Staff"
        description="Who can sign in, and what each of them is allowed to change."
        actions={
          <>
            {can(session, "roles.manage") ? (
              <Button variant="outline" asChild={true}>
                <UiLink href="/roles">
                  {<AppIcon name="keyRound" size="sm" />}
                  {"Roles"}
                </UiLink>
              </Button>
            ) : null}
            <AddPerson roles={roles} />
          </>
        }
      />

      <Lead>
        <Num>{active.length}</Num>{" "}
        {active.length === 1 ? "person can" : "people can"} sign in, across{" "}
        <Num>{roles.length}</Num> {roles.length === 1 ? "role" : "roles"}.{" "}
        <Num>{keyholders}</Num> of them can manage accounts. There is no sign-up
        and no invitation email: you create the account with a password, hand it
        over, and they change it from Account once they are in.
      </Lead>

      {active.length === 0 ? (
        <EmptyState
          icon="users"
          title="Nobody can sign in yet"
          hint="Add the people who take attendance and run the desk. Give each of them the role that lets them do their job and no more."
          action={<AddPerson roles={roles} />}
        />
      ) : (
        <PeopleTable
          people={active}
          roles={roles}
          currentUserId={session.user.id}
        />
      )}

      {inactive.length > 0 ? (
        <section className="min-w-0 flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Deactivated</h2>
          <Lead>
            They cannot sign in. Everything they recorded is still readable, and
            reactivating them gives the same account back.
          </Lead>
          <PeopleTable
            people={inactive}
            roles={roles}
            currentUserId={session.user.id}
          />
        </section>
      ) : null}
    </div>
  );
}

function PeopleTable({
  people,
  roles,
  currentUserId,
}: {
  people: Person[];
  roles: RoleOption[];
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
          <TableHead scope="col" className={"max-lg:hidden"}>
            Classes
          </TableHead>
          <TableHead scope="col">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {people.map((person) => {
          const permissions = person.staffRole?.permissions ?? [];
          const reach = roleReach(permissions);
          const classes = person._count.coursesTaught;
          return (
            <TableRow key={person.id}>
              <TableCell>
                <div className="min-w-0 flex gap-2 items-center flex-wrap">
                  <span className="text-sm text-ui-foreground font-medium">
                    {person.name}
                  </span>
                  {person.id === currentUserId ? (
                    <span className="text-sm text-ui-muted-foreground">
                      (you)
                    </span>
                  ) : null}
                  {!person.hasPassword ? (
                    <Tag color={STAFF_STATUS_META.noPassword.color}>
                      {STAFF_STATUS_META.noPassword.label}
                    </Tag>
                  ) : null}
                </div>
                <span className="text-sm text-ui-muted-foreground block [overflow-wrap:anywhere]">
                  {person.email}
                </span>
                <span
                  className={cn(
                    "text-sm text-ui-muted-foreground block",
                    "lg:hidden",
                  )}
                >
                  {person.staffRole?.name ?? "No role"} · {classes}{" "}
                  {classes === 1 ? "class" : "classes"}
                </span>
              </TableCell>
              <TableCell className={"max-lg:hidden"}>
                <Tag color={reach.color}>
                  {person.staffRole?.name ?? "No role"}
                </Tag>
                <span className="text-sm text-ui-muted-foreground block">
                  {permissionCountLabel(permissions.length)}
                </span>
              </TableCell>
              <TableCell className={"max-lg:hidden"}>
                <span className="text-sm text-ui-muted-foreground tabular-nums">
                  {classes}
                </span>
              </TableCell>
              <TableCell>
                <div
                  className={
                    "min-w-0 flex gap-1 items-center justify-end flex-wrap"
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
