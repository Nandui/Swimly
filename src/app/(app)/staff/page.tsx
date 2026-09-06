import type { Metadata } from "next";
import { KeyRound, Users } from "lucide-react";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
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
    <VStack gap={6}>
      <PageHeader
        title="Staff"
        description="Who can sign in, and what each of them is allowed to change."
        actions={
          <>
            {can(session, "roles.manage") ? (
              <Button
                label="Roles"
                variant="secondary"
                href="/roles"
                icon={<KeyRound className="size-4" aria-hidden />}
              />
            ) : null}
            <AddPerson roles={roles} />
          </>
        }
      />

      <Lead>
        <Num>{active.length}</Num> {active.length === 1 ? "person can" : "people can"} sign in,
        across <Num>{roles.length}</Num> {roles.length === 1 ? "role" : "roles"}.{" "}
        <Num>{keyholders}</Num> of them can manage accounts. There is no sign-up and no invitation
        email: you create the account with a password, hand it over, and they change it from
        Account once they are in.
      </Lead>

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
        <VStack gap={3} as="section">
          <Heading level={2}>Deactivated</Heading>
          <Lead>
            They cannot sign in. Everything they recorded is still readable, and reactivating them
            gives the same account back.
          </Lead>
          <PeopleTable people={inactive} roles={roles} currentUserId={session.user.id} />
        </VStack>
      ) : null}
    </VStack>
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
    <Table hasHover textOverflow="wrap">
      <TableHeader>
        <TableRow isHeaderRow>
          <TableHeaderCell scope="col">Person</TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">
            Role
          </TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">
            Classes
          </TableHeaderCell>
          <TableHeaderCell scope="col">
            <VisuallyHidden>Actions</VisuallyHidden>
          </TableHeaderCell>
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
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Text weight="medium">{person.name}</Text>
                  {person.id === currentUserId ? <Text type="supporting">(you)</Text> : null}
                  {!person.hasPassword ? <Tag color="yellow">No password set</Tag> : null}
                </HStack>
                <Text type="supporting" display="block">
                  {person.email}
                </Text>
                <Text type="supporting" display="block" className="md:hidden">
                  {person.staffRole?.name ?? "No role"} · {classes}{" "}
                  {classes === 1 ? "class" : "classes"}
                </Text>
              </TableCell>
              <TableCell className="max-md:hidden">
                <Tag color={reach.color}>{person.staffRole?.name ?? "No role"}</Tag>
                <Text type="supporting" display="block">
                  {permissionCountLabel(permissions.length)}
                </Text>
              </TableCell>
              <TableCell className="max-md:hidden">
                <Text color="secondary" hasTabularNumbers>
                  {classes}
                </Text>
              </TableCell>
              <TableCell>
                <HStack gap={1} vAlign="center" hAlign="end">
                  <ResetPersonPassword person={person} />
                  <EditPerson person={person} roles={roles} />
                  <SetPersonActive person={person} />
                </HStack>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
