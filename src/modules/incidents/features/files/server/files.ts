import "server-only";
import { prisma } from "@/lib/prisma";
import { fileProblem, IncidentError, MAX_FILE_BYTES, MAX_FILES, safeFileName } from "@/modules/incidents/shared/rules";
import { lockReport, recordEvent, reportRights } from "@/modules/incidents/shared/service";
import type { IncidentsActor } from "@/modules/incidents/shared/types";

/** Photos and documents on a report (docs/incidents.md, phase 2). Kept in the
 *  database like refund receipts. The reporter adds them to their own report
 *  and whoever triages at the site to any; both only until it is closed. Anyone
 *  who may read the report may open them, and opening one someone else's
 *  report is logged like opening its injury details. */

export { MAX_FILE_BYTES };

async function reportFor(who: IncidentsActor, reportId: string) {
  const row = await prisma.incidentReport.findFirst({ where: { id: reportId, orgId: who.orgId ?? undefined } });
  if (!row) throw new IncidentError("This report is no longer available.");
  return { row, rights: await reportRights(row, who) };
}

export async function addFile(who: IncidentsActor, reportId: string, file: File) {
  const { row, rights } = await reportFor(who, reportId);
  if (!rights.own && !rights.review) throw new IncidentError("Only the reporter or someone who triages reports at this site can add files.");
  if (file.size > MAX_FILE_BYTES) throw new IncidentError("Files must be no larger than 4 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const problem = fileProblem(file, bytes);
  if (problem) throw new IncidentError(problem);
  const name = safeFileName(file.name);
  await prisma.$transaction(async (tx) => {
    await lockReport(tx, reportId);
    const now = await tx.incidentReport.findUniqueOrThrow({ where: { id: reportId } });
    if (now.status === "closed") throw new IncidentError("A closed report can't take new files. Reopen it first.");
    if (await tx.incidentFile.count({ where: { reportId, removedAt: null } }) >= MAX_FILES) throw new IncidentError(`A report can have up to ${MAX_FILES} files.`);
    await tx.incidentFile.create({ data: { reportId, name, mime: file.type, size: bytes.length, bytes, addedById: who.id, addedByName: who.name } });
    await recordEvent(tx, row, who, "file_add", name);
  });
}

/** Hidden, not deleted: the record of what was attached stays. */
export async function removeFile(who: IncidentsActor, fileId: string) {
  const file = await prisma.incidentFile.findUnique({ where: { id: fileId }, select: { id: true, reportId: true, name: true, addedById: true, removedAt: true } });
  if (!file || file.removedAt) throw new IncidentError("This file is no longer available. Refresh the page.");
  const { row, rights } = await reportFor(who, file.reportId);
  if (!rights.review && file.addedById !== who.id) throw new IncidentError("Only whoever added it or someone who triages reports at this site can remove a file.");
  await prisma.$transaction(async (tx) => {
    await lockReport(tx, file.reportId);
    const now = await tx.incidentReport.findUniqueOrThrow({ where: { id: file.reportId } });
    if (now.status === "closed") throw new IncidentError("A closed report keeps its files. Reopen it first.");
    const changed = await tx.incidentFile.updateMany({ where: { id: fileId, removedAt: null }, data: { removedAt: new Date(), removedById: who.id } });
    if (!changed.count) throw new IncidentError("This file is no longer available. Refresh the page.");
    await recordEvent(tx, row, who, "file_remove", file.name);
  });
}

export async function readFile(who: IncidentsActor, fileId: string) {
  const file = await prisma.incidentFile.findUnique({ where: { id: fileId } });
  if (!file || file.removedAt) throw new IncidentError("This file is not available.");
  const { rights } = await reportFor(who, file.reportId);
  if (!rights.read) throw new IncidentError("This file is not available.");
  if (!rights.own) await prisma.incidentAccessEvent.create({ data: { reportId: file.reportId, actorId: who.id, actorName: who.name } });
  return file;
}
