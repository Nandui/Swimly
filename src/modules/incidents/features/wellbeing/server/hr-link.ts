import "server-only";
import { logAudit } from "@/lib/audit";
import { formatDate, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/modules/incidents/shared/link";
import { IncidentError } from "@/modules/incidents/shared/rules";
import { lockReport } from "@/modules/incidents/shared/service";
import { incidentCategories, incidentKinds, incidentNumber, type IncidentCategory, type IncidentKind } from "@/modules/incidents/shared/types";
import { siteName } from "@/lib/directory";
import { followUpLabels, HR_REQUEST_KINDS, hrRequestKind, linkProblem, tokenShape, updateProblem, wellbeingExpiry, wellbeingUpdateSchema } from "@/modules/incidents/features/wellbeing/rules";

/** The emailed link's side ("Asking HR"): no sign-in, only
 *  the link's secret, which opens this one request and nothing else. The page
 *  shows who it is about, why, who asked, and what HR has recorded so far
 *  through this link. The report itself only when whoever asked let HR know
 *  about a staff member and ticked to show it: then what happened, as written,
 *  and that person's own injury entry, never anyone else's, and the opening is
 *  in the report's read log like any other. */

async function checkByToken(token: string) {
  if (!tokenShape(token)) return null;
  return prisma.incidentWellbeingCheck.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      report: { select: { id: true, number: true, siteId: true, occurredOn: true, occurredAt: true, area: true, kind: true, category: true, description: true, immediateAction: true } },
      updates: { orderBy: { createdAt: "asc" } },
    },
  });
}

type LinkCheck = NonNullable<Awaited<ReturnType<typeof checkByToken>>>;

/** What happened, for a request that shares it: the report as written and the
 *  person's own injury entry (by their staff record, or the name typed). */
async function sharedReport(c: LinkCheck) {
  if (!c.shareReport || hrRequestKind(c.kind) !== "inform") return null;
  const r = c.report;
  const people = await prisma.incidentPerson.findMany({ where: { reportId: r.id, type: "staff" }, orderBy: { createdAt: "asc" } });
  const person = people.find((p) => c.personUserId && p.userId === c.personUserId)
    ?? people.find((p) => !c.personUserId && p.name.trim().toLowerCase() === c.personName.trim().toLowerCase());
  await prisma.incidentAccessEvent.create({ data: { reportId: r.id, actorId: `wellbeing:${c.id}`, actorName: `HR, through the link from ${c.requestedByName}` } });
  return {
    what: incidentKinds[r.kind as IncidentKind]?.label ?? r.kind,
    category: incidentCategories[r.category as IncidentCategory]?.label ?? r.category,
    at: r.occurredAt, area: r.area, description: r.description, immediateAction: r.immediateAction,
    injury: person ? {
      injured: person.injured, bodyPart: person.bodyPart, injury: person.injury, firstAid: person.firstAid,
      firstAidBy: person.firstAidBy, ambulance: person.ambulance, hospital: person.hospital,
    } : null,
  };
}

/** What the HR page shows, or null for a link that never existed. */
export async function wellbeingLink(token: string) {
  const c = await checkByToken(token);
  if (!c) return null;
  const problem = linkProblem(c);
  return {
    problem, kind: hrRequestKind(c.kind), followUps: followUpLabels(c.followUps), report: problem ? null : await sharedReport(c), site: await siteName(c.report.siteId), reference: incidentNumber(c.report.number),
    occurredOn: formatDate(new Date(`${c.report.occurredOn}T12:00:00Z`)), askedOn: today(c.createdAt), today: today(),
    personName: c.personName, reason: c.reason, requestedByName: c.requestedByName, createdAt: c.createdAt, expiresAt: c.expiresAt,
    updates: c.updates.map((u) => ({ id: u.id, byName: u.byName, doneOn: u.doneOn, whatDone: u.whatDone, nextSteps: u.nextSteps, finished: u.finished, createdAt: u.createdAt })),
  };
}
export type WellbeingLink = NonNullable<Awaited<ReturnType<typeof wellbeingLink>>>;

/** Records what HR did. Saying what happens next keeps the link open for another
 *  30 days; saying nothing more is needed finishes the request and stops the link.
 *  In the report's history and the audit log under the name HR typed, without
 *  what they wrote. */
export async function recordWellbeingUpdate(body: unknown) {
  const parsed = wellbeingUpdateSchema.safeParse(body);
  if (!parsed.success) throw new IncidentError(parsed.error.issues[0].message);
  const input = parsed.data;
  const c = await checkByToken(input.token);
  if (!c) throw new IncidentError("This link isn't valid. Check you opened the whole link from the email.");
  const problem = linkProblem(c) ?? updateProblem(input, today(c.createdAt), today());
  if (problem) throw new IncidentError(problem);
  const by = `${input.byName} (HR, link)`;
  const action = input.finished ? "wellbeing_done" : "wellbeing_update";
  const id = await prisma.$transaction(async (tx) => {
    await lockReport(tx, c.report.id);
    const finished = new Date();
    const changed = await tx.incidentWellbeingCheck.updateMany({
      where: { id: c.id, status: "open", tokenHash: c.tokenHash },
      data: input.finished ? { status: "done", doneAt: finished } : { expiresAt: wellbeingExpiry() },
    });
    if (!changed.count) throw new IncidentError("This link has just been closed. Reply to the email if you still need to add something.");
    const update = await tx.incidentWellbeingUpdate.create({
      data: { checkId: c.id, reportId: c.report.id, byName: input.byName, doneOn: input.doneOn, whatDone: input.whatDone, nextSteps: input.finished ? "" : input.nextSteps, finished: input.finished },
    });
    await tx.incidentEvent.create({ data: { reportId: c.report.id, actorId: `wellbeing:${c.id}`, actorName: by, action } });
    await logAudit({
      actorId: null, actorName: by, entity: "IncidentReport", entityId: c.report.id, clubId: c.report.siteId, action,
      summary: `${incidentNumber(c.report.number)}: ${input.finished ? "HR finished the request" : "HR recorded an update on the request"} (${HR_REQUEST_KINDS[hrRequestKind(c.kind)].label.toLowerCase()}).`,
    }, tx);
    return update.id;
  });
  return { id, checkId: c.id };
}
