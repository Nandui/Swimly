import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Users } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { Button } from "@/components/ui/button";
import {
  AddPerson,
  EditPerson,
  ResetPersonPassword,
  SetPersonActive,
} from "@/components/staff/person-actions";
import { can } from "@/lib/authz";
import { screenPage } from "@/lib/page-guards";
import { permissionCountLabel, roleReach } from "@/lib/staff/constants";
import { expandPermissions } from "@/lib/staff/permissions";
import { listRolesForPicker, type RoleOption } from "@/lib/staff/data/roles";
import { listPeopleForDisplay, type Person } from "@/lib/staff/data/staff";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const session = await screenPage("staff", "staff.manage");

  const [people, roles] = await Promise.all([listPeopleForDisplay(), listRolesForPicker()]);
  const active = people.filter((p) => p.isActive);
  const inactive = people.filter((p) => !p.isActive);
  const keyholders = active.filter((p) =>
    expandPermissions(p.staffRole?.permissions ?? []).has("staff.manage")
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description="Who can sign in, and what each of them is allowed to change."
        actions={
          <div className="flex items-center gap-2">
            {can(session, "roles.manage") ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/roles">
                  <KeyRound className="size-4" />
                  Roles
                </Link>
              </Button>
            ) : null}
            <AddPerson roles={roles} />
          </div>
        }
      />

      <p className="max-w-prose text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{active.length}</span>{" "}
        {active.length === 1 ? "person can" : "people can"} sign in, across{" "}
        <span className="font-medium text-foreground tabular-nums">{roles.length}</span>{" "}
        {roles.length === 1 ? "role" : "roles"}.{" "}
        <span className="font-medium text-foreground tabular-nums">{keyholders}</span> of{" "}
        {keyholders === 1 ? "them can" : "them can"} manage accounts. There is no sign-up and no
        invitation email: you create the account with a password, hand it over, and they change it
        from Account once they are in.
      </p>

      {active.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nobody can sign in yet"
          hint="Add the people who take attendance and run the desk. Give each of them the role that lets them do their job and no more."
          action={<AddPerson roles={roles} />}
        />
      ) : (
        <PeopleTable people={active} roles={roles} currentUserId={session.user.id} />
      )}

      {inactive.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Deactivated</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            They cannot sign in. Everything they recorded is still readable, and reactivating them
            gives the same account back.
          </p>
          <PeopleTable people={inactive} roles={roles} currentUserId={session.user.id} />
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
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-sidebar">
          <tr className="border-b">
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
            >
              Person
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium text-muted-foreground max-md:hidden"
            >
              Role
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium text-muted-foreground max-md:hidden"
            >
              Classes
            </th>
            <th scope="col" className="w-32 px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => {
            const permissions = person.staffRole?.permissions ?? [];
            const reach = roleReach(permissions);
            return (
              <tr
                key={person.id}
                className="group border-b transition-colors last:border-0 hover:bg-accent/40"
              >
                <td className="px-3 py-2 font-medium text-foreground">
                  {person.name}
                  {person.id === currentUserId ? (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>
                  ) : null}
                  {!person.hasPassword ? (
                    <Tag color="yellow" className="ml-2">
                      No password set
                    </Tag>
                  ) : null}
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {person.email}
                  </span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground md:hidden">
                    {person.staffRole?.name ?? "No role"} · {person._count.coursesTaught}{" "}
                    {person._count.coursesTaught === 1 ? "class" : "classes"}
                  </span>
                </td>
                <td className="px-3 py-2 max-md:hidden">
                  <Tag color={reach.color}>{person.staffRole?.name ?? "No role"}</Tag>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {permissionCountLabel(permissions.length)}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground tabular-nums max-md:hidden">
                  {person._count.coursesTaught}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-0.5 max-md:gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
                    <ResetPersonPassword person={person} />
                    <EditPerson person={person} roles={roles} />
                    <SetPersonActive person={person} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
