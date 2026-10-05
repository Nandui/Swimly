import { ItemGroup, ItemContent, Item, ItemActions } from "@/components/shadcn/item";

import { cn } from "@/lib/utils";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import { AddRole, DeleteRole, EditRole } from "@/components/staff/role-actions";
import { screenPage } from "@/lib/page-guards";
import { STAFF_STATUS_META, roleReach } from "@/lib/staff/constants";
import { listRoles, type RoleRow } from "@/lib/staff/data/roles";
import { cleanLevels, describeLevels, levelsFromAccess } from "@/lib/staff/levels";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage() {
  const session = await screenPage("roles", "roles.manage");
  const canGiveRestricted = session.user.isSuperadmin === true;

  const roles = await listRoles();
  const assigned = roles.reduce((n, role) => n + role._count.users, 0);

  return (
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader
        title="Roles"
        description="A role is a job, with one level for each module."
        actions={<AddRole canGiveRestricted={canGiveRestricted} />}
      />

      <Lead>
        <Num>{roles.length}</Num> {roles.length === 1 ? "role" : "roles"}, held between them by{" "}
        <Num>{assigned}</Num> {assigned === 1 ? "account" : "accounts"}. Each level includes the ones before it, and
        people on a role start on its home page.
      </Lead>

      {roles.length === 0 ? (
        <EmptyState
          icon="keyRound"
          title="No roles yet"
          hint="Without a role nobody can sign in, because an account with no role has nowhere to go."
          action={<AddRole canGiveRestricted={canGiveRestricted} />}
        />
      ) : (
        <ItemGroup className="divide-y divide-ui-border">
          {roles.map((role) => (
            <RoleRowItem key={role.id} role={role} canGiveRestricted={canGiveRestricted} />
          ))}
        </ItemGroup>
      )}
    </div>
  );
}

function RoleRowItem({ role, canGiveRestricted }: { role: RoleRow; canGiveRestricted: boolean }) {
  const reach = roleReach(role.permissions);
  const converted = role.levels !== null;
  const levels = converted ? cleanLevels(role.levels, role.extras) : levelsFromAccess(role.permissions, role.screens).role;
  const lines = describeLevels(levels).split(" · ");

  return (
    <Item role="listitem" className={cn("items-start [overflow-wrap:anywhere]", "max-sm:flex-col max-sm:items-stretch")}>
      <ItemContent className="min-w-0 gap-2">
        <div className="min-w-0 flex gap-2 items-center flex-wrap">
          <span className="text-base text-ui-foreground font-semibold">{role.name}</span>
          <Tag meta={reach} />
          {role.isSystem ? <Tag meta={STAFF_STATUS_META.builtInRole} /> : null}
          {converted ? null : <Tag meta={STAFF_STATUS_META.oldSettings} />}
        </div>
        {role.description ? <p className="text-sm text-ui-muted-foreground">{role.description}</p> : null}
        <p className="text-sm text-ui-muted-foreground">
          Home page: {role.homeName || "not named yet"} · <span className="tabular-nums">{role._count.users}</span>{" "}
          {role._count.users === 1 ? "account" : "accounts"}
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ui-foreground" aria-label={`What ${role.name} can do`}>
          {lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </ItemContent>
      <ItemActions className="flex-wrap">
        <div className="min-w-0 flex gap-1 items-center">
          <EditRole role={role} canGiveRestricted={canGiveRestricted} />
          <DeleteRole role={role} users={role._count.users} />
        </div>
      </ItemActions>
    </Item>
  );
}
