import { allModules, type ModuleManifest, type Reach } from "@/modules/registry";
import { expandPermissions, hasAdministratorAccess, type PermissionKey } from "@/lib/staff/permissions";
import { cleanScreens, visibleScreens, type ScreenKey } from "@/lib/staff/screens";

/** A role as the owner thinks of it: one level for each module, plus a few
 *  ticks. See docs/how-turnfin-works.md.
 *
 *  Levels are translated here into the named permissions and screens the app
 *  already checks, so no page or action ever asks for a level. The role row
 *  keeps the translation in `permissions` and `screens` (everything except
 *  HR "Their team", which only the policy engine reads), so every existing
 *  reader of those columns keeps working. */

/** Module id → level key. A missing module means None. */
export type Levels = Readonly<Record<string, string>>;

/** Extras are stored as `moduleId.extraKey`; the one role-wide tick is this. */
export const WORK_ANYWHERE = "work-anywhere";

export type RoleLevels = { levels: Levels; extras: readonly string[] };

export type Access = { permissions: PermissionKey[]; screens: ScreenKey[] };

export type AccessByReach = Record<Reach, Access>;

const ADMIN_MODULE = "admin";

function moduleById(id: string) {
  return allModules().find((m) => m.id === id);
}

function rankOf(mod: ModuleManifest, level: string | undefined) {
  if (!level || level === "none") return -1;
  return mod.access.levels.findIndex((l) => l.key === level);
}

/** Drops unknown modules, levels and extras, so a stored role never grants
 *  something the catalogue no longer describes. */
export function cleanLevels(input: unknown, extras: unknown = []): RoleLevels {
  const levels: Record<string, string> = {};
  if (input && typeof input === "object" && !Array.isArray(input)) {
    for (const [id, level] of Object.entries(input as Record<string, unknown>)) {
      const mod = moduleById(id);
      if (mod && typeof level === "string" && rankOf(mod, level) >= 0) levels[id] = level;
    }
  }
  const kept = (Array.isArray(extras) ? extras : []).filter((key): key is string => {
    if (key === WORK_ANYWHERE) return true;
    if (typeof key !== "string") return false;
    const [id, extra] = key.split(".");
    const mod = moduleById(id);
    const def = mod?.access.extras?.find((e) => e.key === extra);
    return !!mod && !!def && rankOf(mod, levels[id]) >= rankOf(mod, def.from);
  });
  return { levels, extras: [...new Set(kept)].sort() };
}

/** Admin Manage means Manage in every module except restricted ones (HR),
 *  with their extras: today's administrator, stated rather than inherited. */
export function effectiveLevels(role: RoleLevels): RoleLevels {
  if (role.levels[ADMIN_MODULE] !== "manage") return role;
  const levels: Record<string, string> = { ...role.levels };
  const extras = new Set(role.extras);
  for (const mod of allModules()) {
    if (mod.access.restricted) continue;
    levels[mod.id] = mod.access.levels[mod.access.levels.length - 1].key;
    for (const extra of mod.access.extras ?? []) extras.add(`${mod.id}.${extra.key}`);
  }
  extras.add(WORK_ANYWHERE);
  return { levels, extras: [...extras].sort() };
}

function emptyAccess(): Access {
  return { permissions: [], screens: [] };
}

function add(into: Access, permissions: readonly PermissionKey[], screens: readonly ScreenKey[]) {
  into.permissions.push(...permissions);
  into.screens.push(...screens);
}

function tidy(access: Access): Access {
  return { permissions: [...new Set(access.permissions)].sort(), screens: cleanScreens([...new Set(access.screens)]) };
}

/** What a role gives, split by where it applies. */
export function accessByReach(role: RoleLevels): AccessByReach {
  const { levels, extras } = effectiveLevels(role);
  const out: AccessByReach = { everywhere: emptyAccess(), sites: emptyAccess(), team: emptyAccess() };
  for (const mod of allModules()) {
    const rank = rankOf(mod, levels[mod.id]);
    if (rank < 0) continue;
    const chosen = mod.access.levels[rank];
    const into = out[chosen.reach ?? mod.access.reach];
    for (const level of mod.access.levels.slice(0, rank + 1)) add(into, level.permissions, level.screens);
    for (const extra of mod.access.extras ?? []) {
      if (extras.includes(`${mod.id}.${extra.key}`) && rank >= rankOf(mod, extra.from)) add(into, extra.permissions, extra.screens);
    }
  }
  if (extras.includes(WORK_ANYWHERE)) out.everywhere.permissions.push("work.anywhere");
  return { everywhere: tidy(out.everywhere), sites: tidy(out.sites), team: tidy(out.team) };
}

/** What the role row stores in `permissions` and `screens`: everything
 *  except HR "Their team", which reaches only the holder's reports. */
export function storedAccess(role: RoleLevels): Access {
  const { everywhere, sites } = accessByReach(role);
  return tidy({ permissions: [...everywhere.permissions, ...sites.permissions], screens: [...everywhere.screens, ...sites.screens] });
}

/** Whether giving this role needs a superadmin: it holds a restricted module. */
export function isRestrictedRole(role: RoleLevels): boolean {
  return allModules().some((m) => m.access.restricted && rankOf(m, role.levels[m.id]) >= 0);
}

export type Conversion = {
  role: RoleLevels;
  /** Permissions and screens the role did not have before. Review these. */
  gains: string[];
  /** Permissions and screens the role had and would lose. Should be empty. */
  losses: string[];
};

/** Proposes levels for a role that still holds screens and permissions: for
 *  each module, the lowest level that covers everything it held there. Used
 *  by `scripts/convert-roles-to-levels.ts`, which prints the gains for the
 *  owner to review before anything is written. */
export function levelsFromAccess(permissions: readonly string[], screens: readonly string[]): Conversion {
  const beforePermissions = expandPermissions(permissions);
  const beforeScreens = visibleScreens(screens, beforePermissions);
  const levels: Record<string, string> = {};
  const extras: string[] = [];
  const administrator = hasAdministratorAccess(permissions);
  if (administrator) levels[ADMIN_MODULE] = "manage";
  // An administrator already reaches every unrestricted module; only a
  // restricted one (HR) still needs its own level.
  for (const mod of allModules().filter((m) => !administrator || m.access.restricted)) {
    const extraKeys = new Set<string>((mod.access.extras ?? []).flatMap((e) => [...e.permissions, ...e.screens]));
    const held = new Set([...beforePermissions, ...beforeScreens].filter((key) => !extraKeys.has(key)));
    let chosen = -1;
    mod.access.levels.forEach((level, index) => {
      if ([...level.permissions, ...level.screens].some((key) => held.has(key))) chosen = index;
    });
    for (const extra of mod.access.extras ?? []) {
      if (extra.permissions.some((p) => beforePermissions.has(p)) || extra.screens.some((s) => beforeScreens.has(s))) {
        extras.push(`${mod.id}.${extra.key}`);
        chosen = Math.max(chosen, rankOf(mod, extra.from));
      }
    }
    // The role's own keys applied everywhere, so a level that reaches only
    // the holder's team (HR "Their team") would narrow it: take the next
    // level that applies everywhere instead.
    while (chosen >= 0 && mod.access.levels[chosen].reach === "team" && chosen < mod.access.levels.length - 1) chosen += 1;
    if (chosen >= 0) levels[mod.id] = mod.access.levels[chosen].key;
  }
  if (beforePermissions.has("work.anywhere") && !administrator) extras.push(WORK_ANYWHERE);
  const role = cleanLevels(levels, extras);
  const after = accessByReach(role);
  const afterKeys = new Set<string>([...after.everywhere.permissions, ...after.sites.permissions, ...after.team.permissions, ...after.everywhere.screens, ...after.sites.screens, ...after.team.screens]);
  const beforeKeys = new Set<string>([...beforePermissions, ...beforeScreens]);
  return {
    role,
    gains: [...afterKeys].filter((key) => !beforeKeys.has(key)).sort(),
    losses: [...beforeKeys].filter((key) => !afterKeys.has(key)).sort(),
  };
}
