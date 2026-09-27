/** The session user, built from the account row. Pure, so the rule for which
 *  additional roles apply at the current site is unit-tested on its own. */
export const ACCOUNT_SELECT = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  orgId: true,
  isSuperadmin: true,
  staffRole: {
    select: { id: true, name: true, permissions: true, home: true, screens: true },
  },
  roleAssignments: {
    select: { scopeKind: true, scopeId: true, role: { select: { name: true, permissions: true, screens: true } } },
  },
} as const;

export type Account = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  orgId: string | null;
  isSuperadmin: boolean;
  staffRole: {
    id: string;
    name: string;
    permissions: string[];
    home: string;
    screens: string[];
  } | null;
  roleAssignments: { scopeKind: string; scopeId: string; role: { name: string; permissions: string[]; screens: string[] } }[];
};

/** An account with no role has no permissions and no way to be given any
 *  without an admin, so it reads as signed out rather than as a person who can
 *  see the shell and do nothing in it. The column is nullable only because it
 *  had to be added to a table that already had rows.
 *
 *  `permissions` and `screens` are the flat view the existing app checks: what
 *  this person may do **at the site they are working in**. The primary role
 *  applies everywhere; an additional role adds to it when its scope is the
 *  whole organisation or the current site. Department and line-manager scopes
 *  never widen these flat checks — only the policy engine (`src/lib/policy`)
 *  reads them, against a specific person or record. */
export function sessionUserFor(account: Account, currentSiteId: string | null) {
  if (!account.staffRole) return null;
  const assignments = account.roleAssignments ?? [];
  const applies = assignments.filter((assignment) =>
    assignment.scopeKind === "all" || (assignment.scopeKind === "site" && assignment.scopeId === currentSiteId));
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    roleId: account.staffRole.id,
    roleName: account.staffRole.name,
    permissions: [...new Set([...account.staffRole.permissions, ...applies.flatMap((a) => a.role.permissions)])],
    home: account.staffRole.home,
    screens: [...new Set([...account.staffRole.screens, ...applies.flatMap((a) => a.role.screens)])],
    orgId: account.orgId,
    isSuperadmin: account.isSuperadmin,
    grants: assignments.map((a) => ({ roleName: a.role.name, permissions: a.role.permissions, screens: a.role.screens, scopeKind: a.scopeKind, scopeId: a.scopeId })),
    primaryPermissions: account.staffRole.permissions,
    primaryScreens: account.staffRole.screens,
  };
}

