import { accessByReach, cleanLevels } from "@/lib/staff/levels";

/** The session user, built from the account row. Pure, so the rule for what
 *  applies at the current site is unit-tested on its own. */
export const ACCOUNT_SELECT = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  orgId: true,
  isSuperadmin: true,
  siteIds: true,
  staffRole: {
    select: { id: true, name: true, permissions: true, home: true, screens: true, levels: true, extras: true, homeName: true },
  },
} as const;

export type Account = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  orgId: string | null;
  isSuperadmin: boolean;
  /** The sites this person works at; empty means every site. */
  siteIds?: string[];
  staffRole: {
    id: string;
    name: string;
    permissions: string[];
    home: string;
    screens: string[];
    /** Set once the role uses levels (docs/how-turnfin-works.md). */
    levels?: unknown;
    extras?: string[];
    homeName?: string | null;
  } | null;
};

/** An account with no role has no permissions and no way to be given any
 *  without an admin, so it reads as signed out rather than as a person who can
 *  see the shell and do nothing in it. The column is nullable only because it
 *  had to be added to a table that already had rows.
 *
 *  `permissions` and `screens` are the flat view the existing app checks: what
 *  this person may do **at the site they are working in**. `grants` carry
 *  what applies only at their other sites or over their team (HR "Their
 *  team"), which only the policy engine (`src/lib/policy`) reads, against a
 *  specific person or record. One role each (docs/how-turnfin-works.md). */
export function sessionUserFor(account: Account, currentSiteId: string | null) {
  if (!account.staffRole) return null;
  const primary = primaryAccess(account, currentSiteId);
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    roleId: account.staffRole.id,
    roleName: account.staffRole.name,
    permissions: [...new Set(primary.permissions)],
    home: account.staffRole.home,
    screens: [...new Set(primary.screens)],
    orgId: account.orgId,
    isSuperadmin: account.isSuperadmin,
    grants: primary.grants,
    primaryPermissions: primary.everywhere.permissions,
    primaryScreens: primary.everywhere.screens,
  };
}

type Keys = { permissions: string[]; screens: string[] };

/** What the person's own role gives: in the flat checks at the site they are
 *  working in, and as policy grants. A role with levels applies its Swim
 *  school, Training and Rota levels at the person's sites (every site when
 *  none are set) and HR "Their team" to their reports only. A role not yet
 *  converted applies its stored keys everywhere, as before. */
function primaryAccess(account: Account, currentSiteId: string | null) {
  const role = account.staffRole!;
  if (role.levels === null || role.levels === undefined) {
    const stored: Keys = { permissions: role.permissions, screens: role.screens };
    return { ...stored, everywhere: stored, grants: [] as Grant[] };
  }
  const split = accessByReach(cleanLevels(role.levels, role.extras ?? []));
  const sites = account.siteIds ?? [];
  const everywhere: Keys = sites.length === 0
    ? { permissions: [...split.everywhere.permissions, ...split.sites.permissions], screens: [...split.everywhere.screens, ...split.sites.screens] }
    : split.everywhere;
  const hereToo = sites.length > 0 && (currentSiteId === null || sites.includes(currentSiteId));
  const grants: Grant[] = [];
  if (sites.length > 0 && split.sites.permissions.length > 0) {
    for (const siteId of sites) grants.push({ roleName: role.name, permissions: split.sites.permissions, screens: split.sites.screens, scopeKind: "site", scopeId: siteId });
  }
  if (split.team.permissions.length > 0) {
    grants.push({ roleName: role.name, permissions: split.team.permissions, screens: split.team.screens, scopeKind: "reports", scopeId: "" });
  }
  return {
    permissions: [...everywhere.permissions, ...(hereToo ? split.sites.permissions : [])],
    screens: [...everywhere.screens, ...(hereToo ? split.sites.screens : [])],
    everywhere,
    grants,
  };
}

type Grant = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };

