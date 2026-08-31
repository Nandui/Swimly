import type { Metadata } from "next";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import {
  AddPerson,
  EditPerson,
  ResetPersonPassword,
  SetPersonActive,
} from "@/components/staff/person-actions";
import { adminPage } from "@/lib/page-guards";
import { ROLE_META } from "@/lib/staff/constants";
import { listPeopleForDisplay, type Person } from "@/lib/staff/data/staff";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const session = await adminPage();

  const people = await listPeopleForDisplay();
  const active = people.filter((p) => p.isActive);
  const inactive = people.filter((p) => !p.isActive);
  const admins = active.filter((p) => p.role === "ADMIN").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description="Who can sign in, and what each of them is allowed to change."
        actions={<AddPerson />}
      />

      <p className="max-w-prose text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{active.length}</span>{" "}
        {active.length === 1 ? "person can" : "people can"} sign in
        {active.length === 1 ? (
          admins === 1 ? <>, and they are an admin</> : null
        ) : (
          <>
            ,{" "}
            <span className="font-medium text-foreground tabular-nums">{admins}</span> of them{" "}
            {admins === 1 ? "an admin" : "admins"}
          </>
        )}
        . There is no sign-up and no invitation email: you create the account with a password,
        hand it over, and they change it from Account once they are in.
      </p>

      {active.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nobody can sign in yet"
          hint="Add the people who take registers and run the desk. Give each of them the smallest role that lets them do their job."
          action={<AddPerson />}
        />
      ) : (
        <PeopleTable people={active} currentUserId={session.user.id} />
      )}

      {inactive.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Deactivated</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            They cannot sign in. Everything they recorded is still readable, and reactivating them
            gives the same account back.
          </p>
          <PeopleTable people={inactive} currentUserId={session.user.id} />
        </section>
      ) : null}
    </div>
  );
}

function PeopleTable({
  people,
  currentUserId,
}: {
  people: Person[];
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
          {people.map((person) => (
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
                  {ROLE_META[person.role].label} · {person._count.coursesTaught}{" "}
                  {person._count.coursesTaught === 1 ? "class" : "classes"}
                </span>
              </td>
              <td className="px-3 py-2 max-md:hidden">
                <Tag color={ROLE_META[person.role].color}>{ROLE_META[person.role].label}</Tag>
              </td>
              <td className="px-3 py-2 text-muted-foreground tabular-nums max-md:hidden">
                {person._count.coursesTaught}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
                  <ResetPersonPassword person={person} />
                  <EditPerson person={person} />
                  <SetPersonActive person={person} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
