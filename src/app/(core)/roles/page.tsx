import type { Metadata } from "next";

import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { plural } from "@/lib/format";
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
    <div className="min-w-0 flex flex-col gap-4">
      <PageHeader
        title="Roles"
        description="A role is a job, with one level for each module."
        actions={<AddRole canGiveRestricted={canGiveRestricted} />}
      />

      {roles.length === 0 ? (
        <EmptyState
          icon="keyRound"
          title="No roles yet"
          hint="Without a role nobody can sign in, because an account with no role has nowhere to go."
          action={<AddRole canGiveRestricted={canGiveRestricted} />}
        />
      ) : (
        <section className="pc-panel" aria-label="Roles">
          <p className="text-sm text-ui-muted-foreground">
            {plural(roles.length, "role")}, held between them by {plural(assigned, "account")}. Each level includes the
            ones before it, and people on a role start on its home page.
          </p>
          <ul className="pc-rows">
            {roles.map((role) => (
              <RoleRowItem key={role.id} role={role} canGiveRestricted={canGiveRestricted} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RoleRowItem({ role, canGiveRestricted }: { role: RoleRow; canGiveRestricted: boolean }) {
  const reach = roleReach(role.permissions);
  const converted = role.levels !== null;
  const levels = converted ? cleanLevels(role.levels, role.extras) : levelsFromAccess(role.permissions, role.screens).role;
  const about = [role.description, `Home page: ${role.homeName || "not named yet"}`, plural(role._count.users, "account")].filter(Boolean).join(" · ");

  return (
    <li className="pc-row [overflow-wrap:anywhere]">
      <div className="pc-row-body">
        <span className="pc-row-title flex flex-wrap items-center gap-x-2 gap-y-1">
          {role.name}
          <Tag meta={reach} />
          {role.isSystem ? <Tag meta={STAFF_STATUS_META.builtInRole} /> : null}
          {converted ? null : <Tag meta={STAFF_STATUS_META.oldSettings} />}
        </span>
        <span className="pc-row-hint">{about}</span>
        <span className="pc-row-hint">{describeLevels(levels)}</span>
        {converted ? null : <span className="pc-row-hint">Open and save to switch to levels.</span>}
      </div>
      <div className="pc-row-trail">
        <div className="flex flex-nowrap gap-2">
          <EditRole role={role} canGiveRestricted={canGiveRestricted} />
          <DeleteRole role={role} users={role._count.users} />
        </div>
      </div>
    </li>
  );
}
