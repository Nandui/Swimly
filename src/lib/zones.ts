/** Which Turnfin app serves each URL.
 *
 *  Turnfin Work (the repository root app) serves Core and the Work modules and
 *  forwards every Activities path to the Activities app (`apps/activities`),
 *  so staff keep one address and one sign-in. This is Next.js multi-zones:
 *  see docs/architecture.md. The list is the single routing table: Work's
 *  rewrites, the Activities app's config and cross-app links all read it.
 *
 *  A new top-level Activities route must be added here, or Work will 404 it. */

export const ACTIVITIES_PATHS = [
  "/schedule",
  "/students",
  "/courses",
  "/assessments",
  "/awaiting-enrolment",
  "/legend-agreements",
  "/together",
  "/duty",
  "/cancellations",
  "/analytics",
  "/programmes",
  "/today",
  "/start",
  "/reception",
  "/instructor",
  "/api/parent",
  "/api/parent-admin",
  "/api/curriculum-images",
  "/api/operations",
] as const;

/** Where the Activities app serves its own JavaScript and CSS, so its assets
 *  never collide with Work's `/_next`. */
export const ACTIVITIES_ASSET_PREFIX = "/activities-static";

export type Zone = "work" | "activities";

export function zoneFor(href: string): Zone {
  if (!href.startsWith("/")) return "work";
  const path = href.split(/[?#]/)[0];
  return ACTIVITIES_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) || path.startsWith(`${ACTIVITIES_ASSET_PREFIX}/`)
    ? "activities"
    : "work";
}

/** The app this code is running in, fixed at build time. */
export function currentZone(): Zone {
  return process.env.NEXT_PUBLIC_TURNFIN_ZONE === "activities" ? "activities" : "work";
}

/** Whether following this link leaves the current app (a full page load). */
export function crossesZone(href: string, from: Zone = currentZone()): boolean {
  return href.startsWith("/") && zoneFor(href) !== from;
}
