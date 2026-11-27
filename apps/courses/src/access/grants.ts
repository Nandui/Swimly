/** What a person may do in Courses, at their sites (docs/courses.md, Sign-in and access).
 *  People keep their Turnfin account and role: grants are worked out from the role an
 *  administrator already gave them, so access is kept in one place. Code asks for a grant,
 *  never a job title. This file is pure: no database, no session. */
export const GRANTS = {
  desk: "Swimmers, places, moves, waiting lists, bookings and failed payments",
  teach: "The pool deck for your own classes and courses",
  lead: "The pool deck for any class",
  tutor: "Academy courses: candidates, checks, payment, registers and results",
  manage: "Programmes, classes, short course lists, prices, uploads and reports",
  academy: "The Academy course list and putting Academy courses on",
  cancel: "Cancelling today's sessions",
} as const;

export type Grant = keyof typeof GRANTS;
const ALL = Object.keys(GRANTS) as Grant[];

/** What each level of a Turnfin role gives here. The keys are the ids and level keys stored on
 *  the role (docs/apps.md): Classes is `swim-school`. `short-courses` is the app that joined
 *  Classes (D24); a role not saved since still stores its level. */
const FROM_LEVELS: Record<string, Record<string, Grant[]>> = {
  "swim-school": { desk: ["desk"], manage: ["desk", "manage"] },
  "pool-deck": { teach: ["teach"], lead: ["teach", "lead"] },
  academy: { tutor: ["tutor"], manage: ["tutor", "academy"] },
  "short-courses": { view: ["desk"], instructor: ["teach"], manage: ["desk", "manage"] },
};
const FROM_EXTRAS: Record<string, Grant[]> = { "swim-school.cancel-classes": ["cancel"] };

/** The part of a person and their role that decides access. */
export type RoleFacts = {
  isSuperadmin: boolean;
  /** `StaffRole.levels`: app id to level key. Null for no role, or a role with no levels yet. */
  levels: unknown;
  extras: readonly string[];
};

/** The grants a person holds. An administrator (Admin: Manage) or a superadmin holds them all,
 *  as they hold Manage in every app in Turnfin. Anything unknown gives nothing. */
export function grantsFor(facts: RoleFacts): ReadonlySet<Grant> {
  const levels: Record<string, unknown> = facts.levels && typeof facts.levels === "object" && !Array.isArray(facts.levels)
    ? (facts.levels as Record<string, unknown>)
    : {};
  if (facts.isSuperadmin || levels["admin"] === "manage") return new Set(ALL);
  const held = new Set<Grant>();
  for (const [app, level] of Object.entries(levels)) {
    if (typeof level !== "string" || !Object.hasOwn(FROM_LEVELS, app)) continue;
    const byLevel = FROM_LEVELS[app]!;
    if (Object.hasOwn(byLevel, level)) for (const grant of byLevel[level]!) held.add(grant);
  }
  for (const extra of facts.extras) {
    if (Object.hasOwn(FROM_EXTRAS, extra)) for (const grant of FROM_EXTRAS[extra]!) held.add(grant);
  }
  return held;
}

export type Access = { grants: ReadonlySet<Grant>; siteIds: readonly string[] };

/** May this person do this? With a site, also: there? No sites listed means every site. */
export function may(access: Access, grant: Grant, siteId?: string): boolean {
  if (!access.grants.has(grant)) return false;
  return siteId === undefined || access.siteIds.length === 0 || access.siteIds.includes(siteId);
}

/** A database filter for "the sites this person works at": undefined means no filter. */
export function siteFilter(access: Access): { in: string[] } | undefined {
  return access.siteIds.length === 0 ? undefined : { in: [...access.siteIds] };
}
