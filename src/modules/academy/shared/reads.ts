import type { sitesFor } from "@/lib/policy/session";

/** What the Academy's reads share: courses are limited to the sites `academy.read` covers. */

export type Sites = Awaited<ReturnType<typeof sitesFor>>;
export const inSites = (sites: Sites) => (sites.kind === "all" ? {} : { siteId: { in: [...sites.siteIds] } });
export const iso = (d: Date) => d.toISOString().slice(0, 10);
