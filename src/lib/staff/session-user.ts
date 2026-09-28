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
    select: { id: true, name: true, permissions: true, levels: true, extras: true, homeName: true },
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
    /** Set once the role uses levels (docs/how-turnfin-works.md). */
    levels?: unknown;
    extras?: string[];
    homeName?: string | null;
  } | null;
};

/** Where part of a role applies beyond the flat checks: at one of the
 *  person's sites, or over their team. Only the policy engine reads these. */
export type Grant = { roleName: string; permissions: string[]; scopeKind: string; scopeId: string };

/** An account with no role has no permissions and no way to be given any
 *  without an admin, so it reads as signed out rather than as a person who can
 *  see the shell and do nothing in it.
 *
 *  `permissions` is the flat view pages and actions check: what this person
 *  may do **at the site they are working in**. `grants` carry what applies
 *  only at their other sites or over their team (HR "Their team"), which only
 *  the policy engine (`src/lib/policy`) reads, against a specific person or
 *  record. One role each (docs/how-turnfin-works.md). */
export function sessionUserFor(account: Account, currentSiteId: string | null) {
  const role = account.staffRole;
  if (!role) return null;
  const base = { id: account.id, name: account.name, email: account.email, roleId: role.id, roleName: role.name, orgId: account.orgId, isSuperadmin: account.isSuperadmin };

  // A role not yet converted applies its stored permissions everywhere.
  if (role.levels === null || role.levels === undefined) {
    return { ...base, permissions: [...role.permissions], grants: [] as Grant[], primaryPermissions: [...role.permissions] };
  }

  const split = accessByReach(cleanLevels(role.levels, role.extras ?? []));
  const sites = account.siteIds ?? [];
  // No sites means every site: the site-bound levels apply everywhere.
  const everywhere: string[] = sites.length === 0 ? [...split.everywhere, ...split.sites] : [...split.everywhere];
  const hereToo = sites.length > 0 && (currentSiteId === null || sites.includes(currentSiteId));
  const grants: Grant[] = [];
  if (sites.length > 0 && split.sites.length > 0) {
    for (const siteId of sites) grants.push({ roleName: role.name, permissions: split.sites, scopeKind: "site", scopeId: siteId });
  }
  if (split.team.length > 0) grants.push({ roleName: role.name, permissions: split.team, scopeKind: "reports", scopeId: "" });
  return {
    ...base,
    permissions: [...new Set([...everywhere, ...(hereToo ? split.sites : [])])],
    grants,
    primaryPermissions: everywhere,
  };
}
