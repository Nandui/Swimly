import type { Metadata } from "next";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Item } from "@astryxdesign/core/Item";
import { List } from "@astryxdesign/core/List";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import { AddRole, DeleteRole, EditRole } from "@/components/staff/role-actions";
import { screenPage } from "@/lib/page-guards";
import { STAFF_STATUS_META, permissionCountLabel, roleReach } from "@/lib/staff/constants";
import { listRoles, type RoleRow } from "@/lib/staff/data/roles";
import { PERMISSIONS, ROLE_HOMES, expandPermissions, isRoleHome } from "@/lib/staff/permissions";
import { cleanScreens, screenMeta } from "@/lib/staff/screens";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage() {
  await screenPage("roles", "roles.manage");

  const roles = await listRoles();
  const assigned = roles.reduce((n, role) => n + role._count.users, 0);

  return (
    <VStack gap={6}>
      <PageHeader
        title="Roles"
        description="A role is a named set of permissions. People hold one."
        actions={<AddRole />}
      />

      <Lead>
        <Num>{roles.length}</Num> {roles.length === 1 ? "role" : "roles"}, held between them by{" "}
        <Num>{assigned}</Num> {assigned === 1 ? "account" : "accounts"}, out of{" "}
        <Num>{PERMISSIONS.length}</Num> permissions the app has to give. A role names the screens
        its holders can open, and the permissions are the power to change something on them.
      </Lead>

      {roles.length === 0 ? (
        <EmptyState
          icon="keyRound"
          title="No roles yet"
          hint="Without a role nobody can sign in, because an account with no permissions has nowhere to go."
          action={<AddRole />}
        />
      ) : (
        // Records as rows, not a card each: one list, a divider between
        // roles, the permissions folded under each.
        <List hasDividers density="spacious">
          {roles.map((role) => (
            <RoleRowItem key={role.id} role={role} />
          ))}
        </List>
      )}
    </VStack>
  );
}

function RoleRowItem({ role }: { role: RoleRow }) {
  const reach = roleReach(role.permissions);
  const held = expandPermissions(role.permissions);
  const granted = PERMISSIONS.filter((permission) => held.has(permission.key));
  const screens = cleanScreens(role.screens);

  return (
    <Item
      as="li"
      align="start"
      className="max-sm:flex-col max-sm:items-stretch"
      label={
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="large" weight="semibold">
            {role.name}
          </Text>
          <Tag color={reach.color}>{reach.label}</Tag>
          {role.isSystem ? <Tag color={STAFF_STATUS_META.builtInRole.color}>{STAFF_STATUS_META.builtInRole.label}</Tag> : null}
        </HStack>
      }
      description={
        <VStack gap={1}>
          {role.description ? <Text color="secondary">{role.description}</Text> : null}
          <Text type="supporting">
            {permissionCountLabel(role.permissions.length)} ·{" "}
            <Text type="supporting" hasTabularNumbers>
              {role._count.users}
            </Text>{" "}
            {role._count.users === 1 ? "account" : "accounts"} · starts on{" "}
            {(isRoleHome(role.home) ? ROLE_HOMES[role.home] : ROLE_HOMES.overview).label}
          </Text>
          <Text type="supporting">
            Sees{" "}
            {screens.length === 0
              ? "no screens"
              : screens.map((key) => screenMeta(key).label).join(", ")}
          </Text>
          {granted.length === 0 ? (
            <Text type="supporting">Reads the screens above, changes nothing.</Text>
          ) : (
            <Collapsible
              defaultIsOpen={false}
              trigger={
                <Text type="supporting" weight="medium" color="primary">
                  What it may do
                </Text>
              }
            >
              <List density="compact" listStyle="disc">
                {granted.map((permission) => (
                  <Item
                    key={permission.key}
                    as="li"
                    density="compact"
                    label={<Text type="supporting">{permission.label}</Text>}
                  />
                ))}
              </List>
            </Collapsible>
          )}
        </VStack>
      }
      endContent={
        <HStack gap={1} vAlign="center">
          <EditRole role={role} />
          <DeleteRole role={role} users={role._count.users} />
        </HStack>
      }
    />
  );
}
