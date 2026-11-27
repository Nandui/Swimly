/** What an account may do, at its sites (docs/courses.md, Accounts). Code asks for a grant,
 *  never a job title. This file is pure: no database, no session. */
export const GRANTS = {
  desk: "Swimmers, places, moves, waiting lists, bookings and failed payments",
  teach: "The pool deck for their own classes and courses",
  lead: "The pool deck for any class",
  tutor: "Academy courses: candidates, checks, payment, registers and results",
  manage: "Programmes, classes, course lists, prices, uploads and reports",
  cancel: "Cancelling today's sessions",
  accounts: "Accounts and what each may do",
} as const;

export type Grant = keyof typeof GRANTS;

export const isGrant = (value: string): value is Grant => Object.hasOwn(GRANTS, value);

/** A grant that includes others: whoever leads can teach, and whoever manages can work the desk. */
const INCLUDES: Partial<Record<Grant, Grant[]>> = { lead: ["teach"], manage: ["desk"] };

/** The grants an account holds, with the ones they include. Unknown stored values are dropped,
 *  so removing a grant from the list above is safe. */
export function grantsOf(stored: readonly string[]): ReadonlySet<Grant> {
  const held = new Set<Grant>();
  for (const value of stored) {
    if (!isGrant(value)) continue;
    held.add(value);
    for (const included of INCLUDES[value] ?? []) held.add(included);
  }
  return held;
}

export type Access = { grants: ReadonlySet<Grant>; siteIds: readonly string[] };

/** May this account do this? With a site, also: there? No sites listed means every site. */
export function may(access: Access, grant: Grant, siteId?: string): boolean {
  if (!access.grants.has(grant)) return false;
  return siteId === undefined || access.siteIds.length === 0 || access.siteIds.includes(siteId);
}

/** A database filter for "the sites this account works at": undefined means no filter. */
export function siteFilter(access: Access): { in: string[] } | undefined {
  return access.siteIds.length === 0 ? undefined : { in: [...access.siteIds] };
}
