import { allModules, type ModuleManifest, type Reach } from "@/modules/registry";
import { expandPermissions, hasAdministratorAccess, type PermissionKey } from "@/lib/staff/permissions";
import { SCREENS, isScreenKey } from "@/lib/staff/screens";

/** A role as the owner thinks of it: one level for each module, plus a few
 *  ticks (docs/how-turnfin-works.md).
 *
 *  Levels are translated here into the named permissions the app checks, so
 *  no page or action ever asks for a level. The role row keeps the
 *  translation in `permissions` (everything except HR "Their team", which only
 *  the policy engine reads), so every reader of that column works as is. */

/** Module id → level key. A missing module means None. */
export type Levels = Readonly<Record<string, string>>;

/** Extras are stored as `moduleId.extraKey`; the one role-wide tick is this. */
export const WORK_ANYWHERE = "work-anywhere";

export type RoleLevels = { levels: Levels; extras: readonly string[] };

/** What a role gives, split by where it applies. */
export type AccessByReach = Record<Reach, PermissionKey[]>;

const ADMIN_MODULE = "admin";

/** The roles every new database starts with. The seed creates any that are
 *  missing; an admin may rename them and change their levels. */
export const SYSTEM_ROLES: { name: string; description: string; homeName: string; levels: Levels }[] = [
  { name: "Admin", description: "Every module except HR, including people, roles and sites.", homeName: "Management", levels: { admin: "manage" } },
  { name: "Instructor", description: "The class instructor view and nothing else.", homeName: "Pool deck", levels: { "pool-deck": "teach" } },
];

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

const tidy = (keys: PermissionKey[]) => [...new Set(keys)].sort();

/** What a role gives, split by where it applies. */
export function accessByReach(role: RoleLevels): AccessByReach {
  const { levels, extras } = effectiveLevels(role);
  const out: AccessByReach = { everywhere: [], sites: [], team: [] };
  for (const mod of allModules()) {
    const rank = rankOf(mod, levels[mod.id]);
    if (rank < 0) continue;
    const into = out[mod.access.levels[rank].reach ?? mod.access.reach];
    for (const level of mod.access.levels.slice(0, rank + 1)) into.push(...level.permissions);
    for (const extra of mod.access.extras ?? []) {
      if (extras.includes(`${mod.id}.${extra.key}`) && rank >= rankOf(mod, extra.from)) into.push(...extra.permissions);
    }
  }
  if (extras.includes(WORK_ANYWHERE)) out.everywhere.push("work.anywhere");
  return { everywhere: tidy(out.everywhere), sites: tidy(out.sites), team: tidy(out.team) };
}

/** What the role row stores in `permissions`: everything except HR "Their
 *  team", which reaches only the holder's reports. */
export function storedPermissions(role: RoleLevels): PermissionKey[] {
  const { everywhere, sites } = accessByReach(role);
  return tidy([...everywhere, ...sites]);
}

/** Whether giving this role needs a superadmin: it holds a restricted module. */
export function isRestrictedRole(role: RoleLevels): boolean {
  return allModules().some((m) => m.access.restricted && rankOf(m, role.levels[m.id]) >= 0);
}

export type Conversion = {
  role: RoleLevels;
  /** Permissions the role did not have before. Review these. */
  gains: string[];
  /** Permissions the role had and would lose. Should be empty. */
  losses: string[];
};

/** Old screens that opened without any permission. Every other old screen
 *  already needed the permission it needs now, so it adds nothing. */
const OPEN_BEFORE = new Set<string>(["calendar", "students", "courses", "together", "assessments", "awaiting-enrolment", "legend-agreements", "analytics", "duty", "cancellations"]);

/** Proposes levels for a role that still holds old-style permissions and
 *  screens: for each module, the lowest level that covers everything it held
 *  there. An old desk screen counts as "Use the swim school desk"; an old
 *  Reports, Duty or Cancelled classes screen now needs an action permission,
 *  so it is proposed and reported as a gain. Used by
 *  `scripts/convert-roles-to-levels.ts` and the role editor, which show the
 *  gains for the owner to review before anything is written. */
export function levelsFromAccess(permissions: readonly string[], screens: readonly string[]): Conversion {
  const opened = screens.filter((key) => isScreenKey(key) && OPEN_BEFORE.has(key)).map((key) => SCREENS.find((s) => s.key === key)!.requires);
  const before = expandPermissions([...permissions, ...opened.filter((key) => key === "swimschool.desk")]);
  const wanted = expandPermissions([...permissions, ...opened]);
  const levels: Record<string, string> = {};
  const extras: string[] = [];
  const administrator = hasAdministratorAccess(permissions);
  if (administrator) levels[ADMIN_MODULE] = "manage";
  // An administrator already reaches every unrestricted module; only a
  // restricted one (HR) still needs its own level.
  for (const mod of allModules().filter((m) => !administrator || m.access.restricted)) {
    let chosen = -1;
    mod.access.levels.forEach((level, index) => {
      if (level.permissions.some((key) => wanted.has(key))) chosen = index;
    });
    for (const extra of mod.access.extras ?? []) {
      if (extra.permissions.some((key) => wanted.has(key))) {
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
  if (before.has("work.anywhere") && !administrator) extras.push(WORK_ANYWHERE);
  const role = cleanLevels(levels, extras);
  const reach = accessByReach(role);
  const after = expandPermissions([...reach.everywhere, ...reach.sites, ...reach.team]);
  return {
    role,
    gains: [...after].filter((key) => !before.has(key)).sort(),
    losses: [...before].filter((key) => !after.has(key)).sort(),
  };
}

/** Everything a role row stores for these levels, so every save (the role
 *  editor, the converter, the seed) writes the same translation. */
export function roleColumns(role: RoleLevels) {
  const clean = cleanLevels(role.levels, role.extras);
  return { levels: clean.levels, extras: [...clean.extras], permissions: storedPermissions(clean), restricted: isRestrictedRole(clean) };
}

/** "Swim school: Desk (can cancel classes) · Refunds: Use", for the activity
 *  log and the converter's report. */
export function describeLevels(role: RoleLevels): string {
  const parts = allModules().flatMap((mod) => {
    const rank = rankOf(mod, role.levels[mod.id]);
    if (rank < 0) return [];
    const ticks = (mod.access.extras ?? []).filter((e) => role.extras.includes(`${mod.id}.${e.key}`)).map((e) => e.label.toLowerCase());
    return [`${mod.name}: ${mod.access.levels[rank].label}${ticks.length ? ` (${ticks.join(", ")})` : ""}`];
  });
  if (role.extras.includes(WORK_ANYWHERE)) parts.push("can work away from the centre's PCs");
  return parts.length ? parts.join(" · ") : "No modules";
}
