import "server-only";
import { z } from "zod";
import { activeStaffAtSite, staffAccess, withSite } from "@/lib/directory";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireIncidentsActor } from "@/modules/incidents/shared/access";
import { IncidentError } from "@/modules/incidents/shared/rules";
import { lockReport, recordEvent, reportRights } from "@/modules/incidents/shared/service";
import type { IncidentsActor } from "@/modules/incidents/shared/types";
import { defaultDetails, footageRequestSchema, linkExpiry, type FootageRequestInput } from "@/modules/incidents/features/footage/rules";
import { newLinkToken } from "@/modules/incidents/features/footage/server/link";
import { storageReady } from "@/modules/incidents/features/footage/server/storage";

/** CCTV footage requests, the staff side (docs/incidents.md, "CCTV footage").
 *  Whoever triages reports at the site asks for footage while the report is
 *  open, before triage too, because recorders overwrite within days. Not on
 *  your own report, unless you hold Manage, as with triage. Only those who
 *  triage there see the requests and watch the videos; the reporter doesn't. */

async function reportFor(who: IncidentsActor, reportId: string) {
  const row = await prisma.incidentReport.findFirst({ where: { id: reportId, orgId: who.orgId ?? undefined } });
  if (!row) throw new IncidentError("This report is no longer available.");
  const rights = await reportRights(row, who);
  return { row, rights, ask: rights.review && (!rights.own || rights.signoff) };
}

async function requestFor(who: IncidentsActor, requestId: string) {
  const request = await prisma.incidentFootageRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new IncidentError("This request is no longer available. Refresh the page.");
  return { request, ...(await reportFor(who, request.reportId)) };
}

/** A request's state as people read it. */
export type FootageRequestState = "open" | "expired" | "cancelled" | "finished";
const stateOf = (r: { status: string; expiresAt: Date }, reportStatus: string): FootageRequestState =>
  r.status === "cancelled" ? "cancelled" : reportStatus === "closed" ? "finished" : r.expiresAt <= new Date() ? "expired" : "open";

/** What the report page shows: the requests and their videos, for those who
 *  triage at the site, and who could be asked. Null for anyone else. */
export async function footageOnReport(reportId: string) {
  const who = await requireIncidentsActor();
  const { row, rights, ask } = await reportFor(who, reportId);
  if (!rights.review) return null;
  const requests = await prisma.incidentFootageRequest.findMany({
    where: { reportId }, orderBy: { createdAt: "asc" },
    include: { footage: { where: { receivedAt: { not: null }, removedAt: null }, orderBy: { receivedAt: "asc" } } },
  });
  const open = row.status !== "closed";
  const site = await withSite(row, "siteId", "site");
  return {
    canRequest: ask && open, canChange: ask && open, ready: storageReady(),
    staff: ask && open ? await activeStaffAtSite(who.orgId, row.siteId) : [],
    details: defaultDetails({ ...row, site: site.site.name }, (iso) => formatDate(new Date(`${iso}T12:00:00Z`))),
    requests: requests.map((r) => ({
      id: r.id, recipientName: r.recipientName, recipientEmail: r.recipientEmail, details: r.details,
      state: stateOf(r, row.status), expiresAt: r.expiresAt, requestedByName: r.requestedByName, createdAt: r.createdAt,
      emailedAt: r.emailedAt, emailError: r.emailError, cancelledByName: r.cancelledByName,
      footage: r.footage.map((f) => ({ id: f.id, name: f.name, mime: f.mime, size: Number(f.size), uploadedBy: f.uploadedBy, note: f.note, receivedAt: f.receivedAt! })),
    })),
  };
}
export type FootageOnReport = NonNullable<Awaited<ReturnType<typeof footageOnReport>>>;

/** Who it goes to: a staff member at the site, by their account's email, or
 *  anyone else by the name and address typed. */
async function recipientOf(who: IncidentsActor, siteId: string, input: z.output<typeof footageRequestSchema>) {
  if (input.userId) {
    const person = (await activeStaffAtSite(who.orgId, siteId)).find((p) => p.id === input.userId);
    const account = person ? await staffAccess(person.id) : null;
    if (!person || !account?.email) throw new IncidentError("That person has no email address on their account. Choose someone else, or type their email.");
    return { name: person.name, email: account.email, userId: person.id };
  }
  if (input.name.length < 2) throw new IncidentError("Enter the name of the person or company who has the footage.");
  if (!z.string().email().safeParse(input.email).success) throw new IncidentError("Enter a valid email address.");
  return { name: input.name, email: input.email.toLowerCase(), userId: null };
}

/** Creates the request and its link. The caller emails the link once this has committed. */
export async function createFootageRequest(who: IncidentsActor, reportId: string, input: FootageRequestInput) {
  const { row, ask } = await reportFor(who, reportId);
  if (!ask) throw new IncidentError("Only someone who triages reports at this site can ask for footage.");
  if (!storageReady()) throw new IncidentError("Footage storage isn't set up yet, so videos can't be received.");
  const parsed = footageRequestSchema.safeParse(input);
  if (!parsed.success) throw new IncidentError(parsed.error.issues[0].message);
  const to = await recipientOf(who, row.siteId, parsed.data);
  const link = newLinkToken();
  const id = await prisma.$transaction(async (tx) => {
    await lockReport(tx, reportId);
    const now = await tx.incidentReport.findUniqueOrThrow({ where: { id: reportId } });
    if (now.status === "closed") throw new IncidentError("A closed report can't ask for footage. Reopen it first.");
    const created = await tx.incidentFootageRequest.create({
      data: {
        reportId, recipientName: to.name, recipientEmail: to.email, recipientUserId: to.userId, details: parsed.data.details,
        tokenHash: link.hash, expiresAt: linkExpiry(), requestedById: who.id, requestedByName: who.name,
      },
    });
    await recordEvent(tx, now, who, "footage_request", `${to.name} (${to.email})`);
    return created.id;
  });
  return { id, token: link.token };
}

/** A fresh link for another fortnight, by email again. The old link stops working. */
export async function renewFootageRequest(who: IncidentsActor, requestId: string) {
  const { request, row, ask } = await requestFor(who, requestId);
  if (!ask) throw new IncidentError("Only someone who triages reports at this site can send a request again.");
  if (!storageReady()) throw new IncidentError("Footage storage isn't set up yet, so videos can't be received.");
  const link = newLinkToken();
  await prisma.$transaction(async (tx) => {
    await lockReport(tx, row.id);
    const now = await tx.incidentReport.findUniqueOrThrow({ where: { id: row.id } });
    if (now.status === "closed") throw new IncidentError("A closed report can't ask for footage. Reopen it first.");
    await tx.incidentFootageRequest.update({ where: { id: requestId }, data: { tokenHash: link.hash, expiresAt: linkExpiry(), status: "open", cancelledAt: null, cancelledByName: null } });
    await recordEvent(tx, now, who, "footage_resend", request.recipientName);
  });
  return { id: requestId, token: link.token };
}

/** Stops the link, for footage that has all arrived or a request sent to the wrong person. */
export async function cancelFootageRequest(who: IncidentsActor, requestId: string) {
  const { request, row, ask } = await requestFor(who, requestId);
  if (!ask) throw new IncidentError("Only someone who triages reports at this site can cancel a request.");
  await prisma.$transaction(async (tx) => {
    await lockReport(tx, row.id);
    const changed = await tx.incidentFootageRequest.updateMany({ where: { id: requestId, status: "open" }, data: { status: "cancelled", cancelledAt: new Date(), cancelledByName: who.name } });
    if (!changed.count) throw new IncidentError("This request has already been cancelled. Refresh the page.");
    await recordEvent(tx, row, who, "footage_cancel", request.recipientName);
  });
}

/** Hidden, never deleted: the record of what was sent, and the video, stay. */
export async function removeFootage(who: IncidentsActor, footageId: string) {
  const footage = await prisma.incidentFootage.findUnique({ where: { id: footageId } });
  if (!footage || footage.removedAt || !footage.receivedAt) throw new IncidentError("This video is no longer available. Refresh the page.");
  const { row, ask } = await reportFor(who, footage.reportId);
  if (!ask) throw new IncidentError("Only someone who triages reports at this site can remove a video.");
  await prisma.$transaction(async (tx) => {
    await lockReport(tx, row.id);
    const now = await tx.incidentReport.findUniqueOrThrow({ where: { id: row.id } });
    if (now.status === "closed") throw new IncidentError("A closed report keeps its footage. Reopen it first.");
    await tx.incidentFootage.update({ where: { id: footageId }, data: { removedAt: new Date(), removedById: who.id } });
    await recordEvent(tx, now, who, "footage_remove", footage.name);
  });
}

/** One video for someone who triages at the report's site. Every opening is
 *  logged, like opening the report's injury details. */
export async function footageToWatch(who: IncidentsActor, footageId: string) {
  const footage = await prisma.incidentFootage.findUnique({ where: { id: footageId } });
  if (!footage || footage.removedAt || !footage.receivedAt || !footage.url) throw new IncidentError("This video is not available.");
  const { rights } = await reportFor(who, footage.reportId);
  if (!rights.review) throw new IncidentError("This video is not available.");
  return footage;
}

export async function logWatch(who: IncidentsActor, reportId: string) {
  await prisma.incidentAccessEvent.create({ data: { reportId, actorId: who.id, actorName: who.name } });
}
