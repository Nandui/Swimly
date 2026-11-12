import "server-only";
import { activeStaffAtSite } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { requireIncidentsActor } from "@/modules/incidents/shared/access";
import { newLinkToken } from "@/modules/incidents/shared/link";
import { IncidentError } from "@/modules/incidents/shared/rules";
import { lockReport, recordEvent, reportRights } from "@/modules/incidents/shared/service";
import type { IncidentsActor } from "@/modules/incidents/shared/types";
import { followUpLabels, hrRequestKind, wellbeingExpiry, wellbeingRequestSchema, wellbeingState, type WellbeingRequestInput } from "@/modules/incidents/features/wellbeing/rules";
import { wellbeingCopies, wellbeingRecipients } from "@/modules/incidents/features/wellbeing/server/settings";

/** Asking HR, the staff side ("Asking HR"). Whoever triages
 *  reports at the site asks HR to check on someone, or lets HR know a staff
 *  member was in the incident, while the report is open, as with CCTV footage. Not on your own report, unless you hold
 *  Manage. Those who triage at the site see that a check was asked and how it
 *  stands; what HR wrote is health information, so only Manage at the site and
 *  whoever asked read it. The reporter sees none of it. */

async function reportFor(who: IncidentsActor, reportId: string) {
  const row = await prisma.incidentReport.findFirst({ where: { id: reportId, orgId: who.orgId ?? undefined } });
  if (!row) throw new IncidentError("This report is no longer available.");
  const rights = await reportRights(row, who);
  return { row, rights, ask: rights.review && (!rights.own || rights.signoff) };
}

async function checkFor(who: IncidentsActor, checkId: string) {
  const check = await prisma.incidentWellbeingCheck.findUnique({ where: { id: checkId } });
  if (!check) throw new IncidentError("This request is no longer available. Refresh the page.");
  return { check, ...(await reportFor(who, check.reportId)) };
}

/** What the report page shows, for those who triage at the site; null for anyone else. */
export async function wellbeingOnReport(reportId: string) {
  const who = await requireIncidentsActor();
  const { row, rights, ask } = await reportFor(who, reportId);
  if (!rights.review) return null;
  const [checks, to, copies] = await Promise.all([
    prisma.incidentWellbeingCheck.findMany({ where: { reportId }, orderBy: { createdAt: "asc" }, include: { updates: { orderBy: { createdAt: "asc" } } } }),
    wellbeingRecipients(who.orgId),
    wellbeingCopies(who.orgId, row.siteId),
  ]);
  const open = row.status !== "closed";
  const people = await prisma.incidentPerson.findMany({ where: { reportId, type: "staff", userId: { not: null } }, select: { userId: true } });
  const staff = ask && open ? await activeStaffAtSite(who.orgId, row.siteId) : [];
  const involved = new Set(people.map((p) => p.userId));
  return {
    canRequest: ask && open, canChange: ask, recipients: to, copies, settings: who.signoff,
    /** Staff named on the report first, then everyone else at the site. */
    staff: [...staff.filter((p) => involved.has(p.id)), ...staff.filter((p) => !involved.has(p.id))].map((p) => ({ ...p, involved: involved.has(p.id) })),
    checks: checks.map((c) => {
      const readable = rights.signoff || c.requestedById === who.id;
      return {
        id: c.id, kind: hrRequestKind(c.kind), followUps: followUpLabels(c.followUps), shareReport: c.shareReport, personName: c.personName, reason: c.reason, sentTo: c.sentTo, requestedByName: c.requestedByName, createdAt: c.createdAt,
        expiresAt: c.expiresAt, emailError: c.emailError, cancelledByName: c.cancelledByName, doneAt: c.doneAt,
        state: wellbeingState({ ...c, updates: c.updates.length }),
        readable, updateCount: c.updates.length, lastUpdateAt: c.updates.at(-1)?.createdAt ?? null,
        updates: readable ? c.updates.map((u) => ({ id: u.id, byName: u.byName, doneOn: u.doneOn, whatDone: u.whatDone, nextSteps: u.nextSteps, finished: u.finished, createdAt: u.createdAt })) : [],
      };
    }),
  };
}
export type WellbeingOnReport = NonNullable<Awaited<ReturnType<typeof wellbeingOnReport>>>;

/** Who the check is for: a staff member at the site, or a name typed (agency staff, a volunteer). */
async function personOf(who: IncidentsActor, siteId: string, input: { userId: string; name: string }) {
  if (input.userId) {
    const person = (await activeStaffAtSite(who.orgId, siteId)).find((p) => p.id === input.userId);
    if (!person) throw new IncidentError("That person isn't on the team at this site any more. Choose someone else.");
    return { name: person.name, userId: person.id };
  }
  if (input.name.length < 2) throw new IncidentError("Enter the person's name.");
  return { name: input.name, userId: null };
}

/** Creates the request and its link. The caller emails HR once this has committed. */
export async function createWellbeingCheck(who: IncidentsActor, reportId: string, input: WellbeingRequestInput) {
  const { row, ask } = await reportFor(who, reportId);
  if (!ask) throw new IncidentError("Only someone who triages reports at this site can ask HR.");
  const to = await wellbeingRecipients(who.orgId);
  if (!to.length) throw new IncidentError("Nobody is set to get requests to HR yet. Someone with Incidents: Manage adds HR's email in Incidents > Settings.");
  const parsed = wellbeingRequestSchema.safeParse(input);
  if (!parsed.success) throw new IncidentError(parsed.error.issues[0].message);
  const person = await personOf(who, row.siteId, parsed.data);
  const link = newLinkToken();
  const id = await prisma.$transaction(async (tx) => {
    await lockReport(tx, reportId);
    const now = await tx.incidentReport.findUniqueOrThrow({ where: { id: reportId } });
    if (now.status === "closed") throw new IncidentError("A closed report can't ask HR for anything. Reopen it first.");
    const { kind, followUps, shareReport } = parsed.data;
    const created = await tx.incidentWellbeingCheck.create({
      data: {
        reportId, kind, followUps, shareReport, personName: person.name, personUserId: person.userId, reason: parsed.data.reason, sentTo: to.join(", "),
        tokenHash: link.hash, expiresAt: wellbeingExpiry(), requestedById: who.id, requestedByName: who.name,
      },
    });
    await recordEvent(tx, now, who, kind === "inform" ? "wellbeing_inform" : "wellbeing_request");
    return created.id;
  });
  return { id, token: link.token };
}

/** A fresh link for another 30 days, to the addresses in Settings now. The old link stops working. */
export async function renewWellbeingCheck(who: IncidentsActor, checkId: string) {
  const { check, row, ask } = await checkFor(who, checkId);
  if (!ask) throw new IncidentError("Only someone who triages reports at this site can send a request again.");
  if (check.status === "done") throw new IncidentError("This request is finished. Ask HR again if something has changed.");
  const to = await wellbeingRecipients(who.orgId);
  if (!to.length) throw new IncidentError("Nobody is set to get requests to HR. Someone with Incidents: Manage adds HR's email in Incidents > Settings.");
  const link = newLinkToken();
  await prisma.$transaction(async (tx) => {
    await lockReport(tx, row.id);
    const changed = await tx.incidentWellbeingCheck.updateMany({
      where: { id: checkId, status: { not: "done" } },
      data: { tokenHash: link.hash, expiresAt: wellbeingExpiry(), status: "open", sentTo: to.join(", "), cancelledAt: null, cancelledByName: null },
    });
    if (!changed.count) throw new IncidentError("This request is finished. Refresh the page.");
    await recordEvent(tx, row, who, "wellbeing_resend");
  });
  return { id: checkId, token: link.token };
}

/** Stops the link, for a request sent by mistake or no longer needed. What HR wrote stays. */
export async function cancelWellbeingCheck(who: IncidentsActor, checkId: string) {
  const { row, ask } = await checkFor(who, checkId);
  if (!ask) throw new IncidentError("Only someone who triages reports at this site can cancel a request.");
  await prisma.$transaction(async (tx) => {
    await lockReport(tx, row.id);
    const changed = await tx.incidentWellbeingCheck.updateMany({ where: { id: checkId, status: "open" }, data: { status: "cancelled", cancelledAt: new Date(), cancelledByName: who.name } });
    if (!changed.count) throw new IncidentError("This request is no longer open. Refresh the page.");
    await recordEvent(tx, row, who, "wellbeing_cancel");
  });
}
