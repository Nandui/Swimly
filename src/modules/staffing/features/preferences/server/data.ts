import "server-only";
import { notFound } from "next/navigation";
import { today } from "@/lib/format";
import { checkOpen, preferenceChecks } from "@/modules/staffing/shared/rules";
import { pickSite, preferencesAt, settingsFor } from "@/modules/staffing/shared/server";

/** When staff can work at a site: the preference check's dates, and everyone on the rota there
 *  with the times they gave. People whose times cannot fit their contracted hours come first,
 *  then those who changed in this check. Supervise at the site, because it is about named people. */
export async function availabilityPage(siteId: string | undefined) {
  const { who, sites, site } = await pickSite(siteId);
  if (!site) return null;
  if (!site.supervise) notFound();
  const settings = await settingsFor(who.orgId);
  const day = today();
  const { current, next } = preferenceChecks(day, settings);
  const people = await preferencesAt(who.orgId, site.id, settings, day);
  const rank = (p: (typeof people)[number]) => (p.fit?.short ? 0 : p.change === "in_check" ? 1 : p.change === "after_check" ? 2 : 3);
  return {
    who, sites, site, settings,
    check: { current, next, open: current ? checkOpen(current, new Date()) : false },
    people: people.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)),
  };
}
