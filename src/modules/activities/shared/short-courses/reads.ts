import type { sitesFor } from "@/lib/policy/session";

/** What the reads share: courses are limited to the sites `short-courses.read` (the desk) or
 *  `short-courses.run` (instructors) covers. */

export type Sites = Awaited<ReturnType<typeof sitesFor>>;
export const inSites = (sites: Sites) => (sites.kind === "all" ? {} : { siteId: { in: [...sites.siteIds] } });
export { toDateOnlyString as iso } from "@/lib/format";

/** The sites either covers: someone who only takes registers sees the courses at their sites too. */
export function eitherSites(a: Sites, b: Sites): Sites {
  if (a.kind === "all" || b.kind === "all") return { kind: "all" };
  return { kind: "some", siteIds: new Set([...a.siteIds, ...b.siteIds]) };
}
