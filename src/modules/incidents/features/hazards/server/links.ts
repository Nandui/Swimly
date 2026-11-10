import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hazardRegister } from "@/modules/contributions";
import { requireIncidentsActor } from "@/modules/incidents/shared/access";
import { IncidentError } from "@/modules/incidents/shared/rules";
import { lockReport, recordEvent, reportRights } from "@/modules/incidents/shared/service";
import { incidentNumber, type IncidentsActor } from "@/modules/incidents/shared/types";

/** Hazards on a report: whoever triages at the site links the hazards, from the site's risk
 *  assessments, that the incident involved, and may ask for their assessments to be looked at
 *  again. The hazards are another app's (the hazard register plug); where it is switched off at
 *  the site, nothing is offered and links already made still read as they were. Each link is in
 *  the report's history and the activity log. A closed report is reopened first. */

export const linkSchema = z.object({
  operationId: z.uuid(),
  hazardIds: z.array(z.string().min(1).max(100)).min(1, "Choose at least one hazard.").max(20, "Link up to 20 hazards at a time."),
  note: z.string().trim().max(1000).default(""),
  askReview: z.boolean().default(false),
});
export type LinkInput = z.input<typeof linkSchema>;

async function reportFor(who: IncidentsActor, reportId: string) {
  const row = await prisma.incidentReport.findFirst({ where: { id: reportId, orgId: who.orgId ?? undefined } });
  if (!row) throw new IncidentError("This report is no longer available.");
  return { row, rights: await reportRights(row, who) };
}

/** What the report page shows, for those who triage at the site; null for anyone else, and when
 *  there is nothing to show or offer. */
export async function hazardsOnReport(reportId: string) {
  const who = await requireIncidentsActor();
  const { row, rights } = await reportFor(who, reportId);
  if (!rights.review) return null;
  const [links, register] = await Promise.all([
    prisma.incidentHazardLink.findMany({ where: { reportId, removedAt: null }, orderBy: { createdAt: "asc" } }),
    hazardRegister(row.siteId),
  ]);
  const canLink = !!register && row.status !== "closed";
  if (!links.length && !canLink) return null;
  return {
    canLink, canRemove: row.status !== "closed", area: row.area,
    links: links.map((l) => ({ id: l.id, hazardRef: l.hazardRef, hazard: l.hazard, assessment: l.assessment, href: l.href, note: l.note, reviewAsked: l.reviewAsked, addedByName: l.addedByName, createdAt: l.createdAt })),
  };
}
export type HazardsOnReport = NonNullable<Awaited<ReturnType<typeof hazardsOnReport>>>;

/** The site's assessed hazards matching what was typed, those for the report's area first. */
export async function findHazards(who: IncidentsActor, reportId: string, q: string) {
  const { row, rights } = await reportFor(who, reportId);
  if (!rights.review) throw new IncidentError("Only someone who triages reports at this site can link hazards.");
  const register = await hazardRegister(row.siteId);
  if (!register) return [];
  const linked = new Set((await prisma.incidentHazardLink.findMany({ where: { reportId, removedAt: null }, select: { hazardId: true } })).map((l) => l.hazardId));
  return (await register.search(row.siteId, q.slice(0, 100), row.area)).filter((h) => !linked.has(h.id));
}

/** Links the hazards. Returns what to announce once this has committed, when a review was asked
 *  for: the caller emits it, so nothing is announced for a change that did not save. */
export async function linkHazards(who: IncidentsActor, reportId: string, input: LinkInput) {
  const { row, rights } = await reportFor(who, reportId);
  if (!rights.review) throw new IncidentError("Only someone who triages reports at this site can link hazards.");
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) throw new IncidentError(parsed.error.issues[0].message);
  const { operationId, note, askReview } = parsed.data;
  const register = await hazardRegister(row.siteId);
  if (!register) throw new IncidentError("Risk assessments is not in use at this site.");
  const hazards = await register.byIds(row.siteId, [...new Set(parsed.data.hazardIds)]);
  if (!hazards.length) throw new IncidentError("Those hazards are no longer on an assessment in use. Search again.");
  const added = await prisma.$transaction(async (tx) => {
    await lockReport(tx, reportId);
    const now = await tx.incidentReport.findUniqueOrThrow({ where: { id: reportId } });
    if (now.status === "closed") throw new IncidentError("A closed report can't take new links. Reopen it first.");
    const already = new Set((await tx.incidentHazardLink.findMany({ where: { reportId, removedAt: null }, select: { hazardId: true } })).map((l) => l.hazardId));
    const fresh = hazards.filter((h) => !already.has(h.id));
    if (!fresh.length) throw new IncidentError("Those hazards are already linked. Refresh the page.");
    await tx.incidentHazardLink.createMany({
      data: fresh.map((h) => ({ orgId: now.orgId, reportId, hazardId: h.id, hazardRef: h.reference, hazard: h.hazard, assessment: h.assessment, href: h.href, note, reviewAsked: askReview, addedById: who.id, addedByName: who.name })),
    });
    await recordEvent(tx, now, who, "hazard_link", `${fresh.map((h) => h.reference).join(", ")}${askReview ? ". Review asked for." : ""}`);
    return fresh;
  });
  const orgId = row.orgId ?? who.orgId;
  if (!askReview || !orgId) return null;
  return { orgId, siteId: row.siteId, incidentId: row.id, incident: incidentNumber(row.number), operationId, hazardIds: added.map((h) => h.id), note, flaggedById: who.id, flaggedByName: who.name };
}

/** Takes a link off the report. What was asked of the assessment's writers stays with them. */
export async function unlinkHazard(who: IncidentsActor, linkId: string) {
  const link = await prisma.incidentHazardLink.findUnique({ where: { id: linkId }, select: { reportId: true, hazardRef: true } });
  if (!link) throw new IncidentError("This link is no longer there. Refresh the page.");
  const { row, rights } = await reportFor(who, link.reportId);
  if (!rights.review) throw new IncidentError("Only someone who triages reports at this site can remove a link.");
  await prisma.$transaction(async (tx) => {
    await lockReport(tx, row.id);
    const now = await tx.incidentReport.findUniqueOrThrow({ where: { id: row.id } });
    if (now.status === "closed") throw new IncidentError("A closed report can't be changed. Reopen it first.");
    const changed = await tx.incidentHazardLink.updateMany({ where: { id: linkId, removedAt: null }, data: { removedAt: new Date(), removedById: who.id } });
    if (!changed.count) throw new IncidentError("This link was already removed. Refresh the page.");
    await recordEvent(tx, now, who, "hazard_unlink", link.hazardRef);
  });
}
