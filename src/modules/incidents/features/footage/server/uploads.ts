import "server-only";
import { randomUUID } from "node:crypto";
import { logAudit } from "@/lib/audit";
import { siteName } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { IncidentError } from "@/modules/incidents/shared/rules";
import { lockReport } from "@/modules/incidents/shared/service";
import { incidentNumber } from "@/modules/incidents/shared/types";
import {
  footageName, footagePath, footageProblem, footageType, linkProblem, MAX_FOOTAGE_BYTES, MAX_FOOTAGE_FILES, tokenShape, UPLOAD_HOURS,
  uploadDoneSchema, uploadStartSchema,
} from "@/modules/incidents/features/footage/rules";
import { hashToken } from "@/modules/incidents/shared/link";
import { stored, uploadToken } from "@/modules/incidents/features/footage/server/storage";

/** The emailed link's side (docs/incidents.md, "CCTV footage"): no sign-in,
 *  only the link's secret, which opens this one request and nothing else. The
 *  page shows what was asked for and by whom, never who was involved or what
 *  happened. Videos go from the browser straight to the private store; the
 *  report records each one once the store has all of it. */

/** Unfinished uploads count too, so a link can't be used to fill the store. */
const MAX_STARTS = MAX_FOOTAGE_FILES * 3;

async function requestByToken(token: string) {
  if (!tokenShape(token)) return null;
  return prisma.incidentFootageRequest.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      report: { select: { id: true, number: true, siteId: true, status: true, reporterId: true } },
      footage: { where: { receivedAt: { not: null }, removedAt: null }, orderBy: { receivedAt: "asc" }, select: { id: true, name: true, size: true, receivedAt: true } },
    },
  });
}

/** What the upload page shows, or null for a link that never existed. */
export async function footageLink(token: string) {
  const r = await requestByToken(token);
  if (!r) return null;
  return {
    problem: linkProblem(r), site: await siteName(r.report.siteId), reference: incidentNumber(r.report.number),
    recipientName: r.recipientName, requestedByName: r.requestedByName, details: r.details, expiresAt: r.expiresAt,
    received: r.footage.map((f) => ({ id: f.id, name: f.name, size: Number(f.size), receivedAt: f.receivedAt! })),
  };
}
export type FootageLink = NonNullable<Awaited<ReturnType<typeof footageLink>>>;

/** Starts one video: checks the link and the file, keeps a row for it, and
 *  hands back a token that uploads to its one path only. */
export async function startUpload(body: unknown) {
  const parsed = uploadStartSchema.safeParse(body);
  if (!parsed.success) throw new IncidentError(parsed.error.issues[0].message);
  const input = parsed.data;
  const r = await requestByToken(input.token);
  if (!r) throw new IncidentError("This link isn't valid. Check you opened the whole link from the email.");
  const problem = linkProblem(r) ?? footageProblem(input, r.footage.length);
  if (problem) throw new IncidentError(problem);
  if (await prisma.incidentFootage.count({ where: { requestId: r.id } }) >= MAX_STARTS) {
    throw new IncidentError("This link has had too many uploads started. Reply to the email to ask for a new one.");
  }
  const id = randomUUID(), name = footageName(input.name), mime = footageType(input.name)!;
  const pathname = footagePath(r.id, id, name);
  await prisma.incidentFootage.create({
    data: { id, requestId: r.id, reportId: r.report.id, name, mime, size: BigInt(input.size), pathname, uploadedBy: input.uploadedBy, note: input.note },
  });
  const until = new Date(Math.min(r.expiresAt.getTime(), Date.now() + UPLOAD_HOURS * 3_600_000));
  return { footageId: id, pathname, contentType: mime, clientToken: await uploadToken(pathname, mime, Math.min(input.size, MAX_FOOTAGE_BYTES), until) };
}

/** Records a video once the store holds all of it, in the report's history
 *  and the activity log, under the name the person gave. */
export async function finishUpload(body: unknown) {
  const parsed = uploadDoneSchema.safeParse(body);
  if (!parsed.success) throw new IncidentError("Something went wrong. Try sending the video again.");
  const r = await requestByToken(parsed.data.token);
  // A link cancelled mid-upload refuses it; one that expired mid-upload doesn't,
  // since the store only took the video while its token was still good.
  if (!r || r.status === "cancelled") throw new IncidentError("This link has been cancelled.");
  const footage = await prisma.incidentFootage.findFirst({ where: { id: parsed.data.footageId, requestId: r.id } });
  if (!footage) throw new IncidentError("Something went wrong. Try sending the video again.");
  if (footage.receivedAt) return { id: footage.id, fresh: false };
  const blob = await stored(footage.pathname);
  if (!blob || BigInt(blob.size) !== footage.size) throw new IncidentError("The video didn't arrive in full. Try sending it again.");
  const by = `${footage.uploadedBy} (footage link)`;
  const fresh = await prisma.$transaction(async (tx) => {
    await lockReport(tx, r.report.id);
    const changed = await tx.incidentFootage.updateMany({ where: { id: footage.id, receivedAt: null }, data: { receivedAt: new Date(), url: blob.url } });
    if (!changed.count) return false;
    await tx.incidentEvent.create({ data: { reportId: r.report.id, actorId: `footage:${r.id}`, actorName: by, action: "footage_received", note: footage.name } });
    await logAudit({
      actorId: null, actorName: by, entity: "IncidentReport", entityId: r.report.id, clubId: r.report.siteId, action: "footage_received",
      summary: `${incidentNumber(r.report.number)}: CCTV footage received from ${r.recipientName} (${footage.name}).`,
    }, tx);
    return true;
  });
  return { id: footage.id, fresh };
}
