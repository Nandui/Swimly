import {
  ItemGroup,
  ItemContent,
  Item,
  ItemActions,
} from "@/components/shadcn/item";

import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/shadcn/collapsible";

import { Button } from "@/components/shadcn/button";

import { cn } from "@/lib/utils";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import { AddRole, DeleteRole, EditRole } from "@/components/staff/role-actions";
import { screenPage } from "@/lib/page-guards";
import {
  STAFF_STATUS_META,
  permissionCountLabel,
  roleReach,
} from "@/lib/staff/constants";
import { listRoles, type RoleRow } from "@/lib/staff/data/roles";
import {
  PERMISSIONS,
  ROLE_HOMES,
  expandPermissions,
  isRoleHome,
  hasAdministratorAccess,
} from "@/lib/staff/permissions";
import { visibleScreens, screenMeta } from "@/lib/staff/screens";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage() {
  await screenPage("roles", "roles.manage");

  const roles = await listRoles();
  const assigned = roles.reduce((n, role) => n + role._count.users, 0);

  return (
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader
        title="Roles"
        description="A role is a named set of permissions. People hold one."
        actions={<AddRole />}
      />

      <Lead>
        <Num>{roles.length}</Num> {roles.length === 1 ? "role" : "roles"}, held
        between them by <Num>{assigned}</Num>{" "}
        {assigned === 1 ? "account" : "accounts"}, out of{" "}
        <Num>{PERMISSIONS.length}</Num> permissions the app has to give. A role
        names the screens its holders can open, and the permissions are the
        power to change something on them.
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
        <ItemGroup className="divide-y divide-ui-border">
          {roles.map((role) => (
            <RoleRowItem key={role.id} role={role} />
          ))}
        </ItemGroup>
      )}
    </div>
  );
}

function RoleRowItem({ role }: { role: RoleRow }) {
  const reach = roleReach(role.permissions);
  const held = expandPermissions(role.permissions);
  const granted = PERMISSIONS.filter((permission) => held.has(permission.key));
  const screens = [...visibleScreens(role.screens, held)];
  const administrator = hasAdministratorAccess(role.permissions);

  return (
    <Item
      role="listitem"
      className={cn(
        "items-start [overflow-wrap:anywhere]",
        "max-sm:flex-col max-sm:items-stretch",
      )}
    >
      <ItemContent className="min-w-0">
        <div className="text-sm font-medium">
          {
            <div className="min-w-0 flex gap-2 items-center flex-wrap">
              <span className="text-base text-ui-foreground font-semibold">
                {role.name}
              </span>
              <Tag color={reach.color}>{reach.label}</Tag>
              {role.isSystem ? (
                <Tag color={STAFF_STATUS_META.builtInRole.color}>
                  {STAFF_STATUS_META.builtInRole.label}
                </Tag>
              ) : null}
            </div>
          }
        </div>
        <div className="text-sm text-ui-muted-foreground">
          {
            <div className="min-w-0 flex flex-col gap-1">
              {role.description ? (
                <span className="text-sm text-ui-muted-foreground">
                  {role.description}
                </span>
              ) : null}
              <span className="text-sm text-ui-muted-foreground">
                {administrator ? "Administrator access" : permissionCountLabel(held.size)} ·{" "}
                <span className="text-sm text-ui-muted-foreground tabular-nums">
                  {role._count.users}
                </span>{" "}
                {role._count.users === 1 ? "account" : "accounts"} · starts on{" "}
                {
                  (isRoleHome(role.home)
                    ? ROLE_HOMES[role.home]
                    : ROLE_HOMES.calendar
                  ).label
                }
              </span>
              <span className="text-sm text-ui-muted-foreground">
                {administrator ? "All screens and permissions, including future additions." : screens.length === 0
                  ? "no screens"
                  : `Sees ${screens.map((key) => screenMeta(key).label).join(", ")}`}
              </span>
              {granted.length === 0 ? (
                <span className="text-sm text-ui-muted-foreground">
                  Reads the screens above, changes nothing.
                </span>
              ) : (
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="justify-start">
                      {
                        <span className="text-sm text-ui-foreground font-medium">
                          What it may do
                        </span>
                      }
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ItemGroup>
                      {granted.map((permission) => (
                        <Item
                          key={permission.key}
                          role="listitem"
                          size="sm"
                          className="[overflow-wrap:anywhere]"
                        >
                          <ItemContent className="min-w-0">
                            <div className="text-sm font-medium">
                              {
                                <span className="text-sm text-ui-muted-foreground">
                                  {permission.label}
                                </span>
                              }
                            </div>
                          </ItemContent>
                        </Item>
                      ))}
                    </ItemGroup>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          }
        </div>
      </ItemContent>
      <ItemActions className="flex-wrap">
        {
          <div className="min-w-0 flex gap-1 items-center">
            <EditRole role={role} />
            <DeleteRole role={role} users={role._count.users} />
          </div>
        }
      </ItemActions>
    </Item>
  );
}
