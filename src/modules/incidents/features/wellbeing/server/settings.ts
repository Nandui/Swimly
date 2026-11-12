import "server-only";
import { logAudit } from "@/lib/audit";
import { liveSitesOf } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { IncidentError } from "@/modules/incidents/shared/rules";
import type { IncidentsActor } from "@/modules/incidents/shared/types";
import { recipientList, recipientsProblem } from "@/modules/incidents/features/wellbeing/rules";

/** Who gets wellbeing check requests (owner request, 22 October 2026: "let me
 *  define who is to receive these emails"): a list of addresses, not a role, set
 *  in Incidents > Settings by someone with Manage. Empty until then. */

/** Each site's own Copy to list, as stored: site id to "a@x, b@y". */
const bySite = (value: unknown): Record<string, string> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => typeof e[1] === "string"))
    : {};

/** Who is copied (CC) on a request about this site (owner requests, 22 October
 *  2026: "always cc me", "each site might require a different CC person"): the
 *  addresses for every site, then the site's own. */
export async function wellbeingCopies(orgId: string | null, siteId: string): Promise<string[]> {
  if (!orgId) return [];
  const row = await prisma.incidentsSettings.findUnique({ where: { orgId }, select: { wellbeingCc: true, wellbeingCcBySite: true } });
  return [...new Set([...recipientList(row?.wellbeingCc ?? ""), ...recipientList(bySite(row?.wellbeingCcBySite)[siteId] ?? "")])];
}

export async function wellbeingRecipients(orgId: string | null): Promise<string[]> {
  if (!orgId) return [];
  return recipientList((await prisma.incidentsSettings.findUnique({ where: { orgId }, select: { wellbeingTo: true } }))?.wellbeingTo ?? "");
}

/** The setting as the Settings page shows it, with who last changed it. */
export async function wellbeingSetting(orgId: string | null) {
  const [row, sites] = await Promise.all([orgId ? prisma.incidentsSettings.findUnique({ where: { orgId } }) : null, liveSitesOf(orgId)]);
  const perSite = bySite(row?.wellbeingCcBySite);
  return {
    to: recipientList(row?.wellbeingTo ?? ""), cc: recipientList(row?.wellbeingCc ?? ""),
    sites: sites.map((site) => ({ id: site.id, name: site.name, cc: recipientList(perSite[site.id] ?? "") })), changedByName: row?.changedByName ?? null, changedAt: row?.updatedAt ?? null };
}

export async function saveWellbeingRecipients(who: IncidentsActor, typed: string, typedCc: string, typedBySite: Record<string, string>) {
  if (!who.signoff || !who.orgId) throw new IncidentError("Changing who gets wellbeing checks needs Incidents: Manage.");
  const list = recipientList(typed), copies = recipientList(typedCc);
  const sites = await liveSitesOf(who.orgId);
  const perSite = sites.map((site) => ({ site, list: recipientList(typedBySite[site.id] ?? "") }));
  const problem = recipientsProblem(list) ?? recipientsProblem(copies)
    ?? perSite.map((p) => { const wrong = recipientsProblem(p.list); return wrong && `${p.site.name}: ${wrong}`; }).find(Boolean);
  if (problem) throw new IncidentError(problem);
  const wellbeingTo = list.join(", "), wellbeingCc = copies.join(", ");
  const wellbeingCcBySite = Object.fromEntries(perSite.filter((p) => p.list.length).map((p) => [p.site.id, p.list.join(", ")]));
  const siteSummary = perSite.filter((p) => p.list.length).map((p) => `; ${p.site.name} also copies ${p.list.join(", ")}`).join("");
  await prisma.$transaction(async (tx) => {
    await tx.incidentsSettings.upsert({
      where: { orgId: who.orgId! },
      create: { orgId: who.orgId!, wellbeingTo, wellbeingCc, wellbeingCcBySite, changedById: who.id, changedByName: who.name },
      update: { wellbeingTo, wellbeingCc, wellbeingCcBySite, changedById: who.id, changedByName: who.name },
    });
    await logAudit({
      actorId: who.id, actorName: who.name, action: "update", entity: "IncidentsSettings", entityId: who.orgId!,
      summary: `${wellbeingTo ? `Wellbeing check requests now go to ${wellbeingTo}` : "Wellbeing check requests now go to nobody"}${wellbeingCc ? `, copied to ${wellbeingCc}` : ", copied to nobody"}${siteSummary}`,
    }, tx);
  });
}
