import "server-only";
import { logAudit } from "@/lib/audit";
import { formatDate, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/modules/incidents/shared/link";
import { IncidentError } from "@/modules/incidents/shared/rules";
import { lockReport } from "@/modules/incidents/shared/service";
import { incidentNumber } from "@/modules/incidents/shared/types";
import { siteName } from "@/lib/directory";
import { linkProblem, tokenShape, updateProblem, wellbeingExpiry, wellbeingUpdateSchema } from "@/modules/incidents/features/wellbeing/rules";

/** The emailed link's side (docs/incidents.md, "Wellbeing checks"): no sign-in,
 *  only the link's secret, which opens this one request and nothing else. The
 *  page shows who to check on, why, who asked, and what HR has recorded so far
 *  through this link; never the report itself. */

async function checkByToken(token: string) {
  if (!tokenShape(token)) return null;
  return prisma.incidentWellbeingCheck.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { report: { select: { id: true, number: true, siteId: true, occurredOn: true } }, updates: { orderBy: { createdAt: "asc" } } },
  });
}

/** What the HR page shows, or null for a link that never existed. */
export async function wellbeingLink(token: string) {
  const c = await checkByToken(token);
  if (!c) return null;
  return {
    problem: linkProblem(c), site: await siteName(c.report.siteId), reference: incidentNumber(c.report.number),
    occurredOn: formatDate(new Date(`${c.report.occurredOn}T12:00:00Z`)), askedOn: today(c.createdAt), today: today(),
    personName: c.personName, reason: c.reason, requestedByName: c.requestedByName, createdAt: c.createdAt, expiresAt: c.expiresAt,
    updates: c.updates.map((u) => ({ id: u.id, byName: u.byName, doneOn: u.doneOn, whatDone: u.whatDone, nextSteps: u.nextSteps, finished: u.finished, createdAt: u.createdAt })),
  };
}
export type WellbeingLink = NonNullable<Awaited<ReturnType<typeof wellbeingLink>>>;

/** Records what HR did. Saying what happens next keeps the link open for another
 *  30 days; saying nothing more is needed finishes the check and stops the link.
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
  const by = `${input.byName} (HR, wellbeing link)`;
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
      summary: `${incidentNumber(c.report.number)}: ${input.finished ? "HR finished the wellbeing check" : "HR recorded a wellbeing check update"}.`,
    }, tx);
    return update.id;
  });
  return { id, checkId: c.id };
}
