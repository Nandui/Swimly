import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { AddRole, DeleteRole, EditRole } from "@/components/staff/role-actions";
import { permissionPage } from "@/lib/page-guards";
import { permissionCountLabel, roleReach } from "@/lib/staff/constants";
import { listRoles, type RoleRow } from "@/lib/staff/data/roles";
import { PERMISSIONS, ROLE_HOMES, expandPermissions, isRoleHome } from "@/lib/staff/permissions";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage() {
  await permissionPage("roles.manage");

  const roles = await listRoles();
  const assigned = roles.reduce((n, role) => n + role._count.users, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        description="A role is a named set of permissions. People hold one."
        actions={<AddRole />}
      />

      <p className="max-w-prose text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{roles.length}</span>{" "}
        {roles.length === 1 ? "role" : "roles"}, held between them by{" "}
        <span className="font-medium text-foreground tabular-nums">{assigned}</span>{" "}
        {assigned === 1 ? "account" : "accounts"}, out of{" "}
        <span className="font-medium text-foreground tabular-nums">{PERMISSIONS.length}</span>{" "}
        permissions the app has to give. Everyone signed in can read swimmers, classes, the
        curriculum and the registers; everything below is the power to change something.
      </p>

      {roles.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No roles yet"
          hint="Without a role nobody can sign in, because an account with no permissions has nowhere to go."
          action={<AddRole />}
        />
      ) : (
        <ul className="space-y-3">
          {roles.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RoleCard({ role }: { role: RoleRow }) {
  const reach = roleReach(role.permissions);
  const held = expandPermissions(role.permissions);
  const granted = PERMISSIONS.filter((permission) => held.has(permission.key));

  return (
    <li className="overflow-hidden rounded-md border">
      <div className="group flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b bg-sidebar p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {role.name}
            <Tag color={reach.color} className="ml-2">
              {reach.label}
            </Tag>
            {role.isSystem ? (
              <Tag color="gray" className="ml-1.5">
                Built in
              </Tag>
            ) : null}
          </p>
          {role.description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{role.description}</p>
          ) : null}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {permissionCountLabel(role.permissions.length)} ·{" "}
            <span className="tabular-nums">{role._count.users}</span>{" "}
            {role._count.users === 1 ? "account" : "accounts"} · starts on{" "}
            {(isRoleHome(role.home) ? ROLE_HOMES[role.home] : ROLE_HOMES.overview).label}
          </p>
        </div>
        <div className="flex items-center gap-0.5 max-md:gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
          <EditRole role={role} />
          <DeleteRole role={role} users={role._count.users} />
        </div>
      </div>

      {granted.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">
          Reads everything, changes nothing.
        </p>
      ) : (
        <ul className="p-3 text-sm">
          {granted.map((permission) => (
            <li key={permission.key} className="flex gap-2 py-0.5 text-muted-foreground">
              <span aria-hidden className="select-none">
                ·
              </span>
              <span>{permission.label}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
