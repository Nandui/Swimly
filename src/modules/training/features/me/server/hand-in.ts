import "server-only";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { fileProblem, safeFileName, storedMime } from "@/modules/training/shared/files";
import { lessonHandIn, lessonPlace } from "@/modules/training/shared/lessons";
import { offlineLabel, offlineTime } from "@/modules/training/features/me/server/offline";
import { lockedBecause, mine, type Db } from "@/modules/training/features/me/server/course";

/** Hand in work (e-learning phase 8): the learner's answer to
 *  a Hand in work lesson, sent from Turnfin Me. One a lesson; handing in again
 *  replaces it until a trainer accepts it. Only ever the signed-in person's own. */

const SUBMISSION = { id: true, status: true, text: true, fileName: true, mime: true, size: true, feedback: true, reviewedByName: true, reviewedAt: true, submittedAt: true } as const;

export async function submissionFor(db: Db, assignmentId: string, lessonId: string) {
  const row = await db.trainingSubmission.findUnique({ where: { assignmentId_lessonId: { assignmentId, lessonId } }, select: SUBMISSION });
  return row && { ...row, status: row.status as "SUBMITTED" | "ACCEPTED" | "RETURNED" };
}

export const MAX_HAND_IN_TEXT = 5000;
/** Photos and PDFs a learner hands in. */
export const HAND_IN_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** `at`: when it was handed in on the phone with no signal (phase 9), if believable. */
export type HandIn = { text: string; file: { name: string; mime: string; bytes: Buffer } | null; keepFile: boolean; at?: string | null };

export async function handInWork(me: { id: string; name: string }, assignmentId: string, lessonId: string, work: HandIn): Promise<ActionResult> {
  const text = work.text.trim().slice(0, MAX_HAND_IN_TEXT);
  if (work.file) {
    const mime = storedMime(work.file.mime);
    if (!HAND_IN_TYPES.includes(mime)) return fail("Hand in a photo (JPEG, PNG or WebP) or a PDF.");
    const problem = fileProblem({ name: work.file.name, type: mime, size: work.file.bytes.length }, work.file.bytes);
    if (problem) return fail("Hand in a photo (JPEG, PNG or WebP) or a PDF, up to 4 MB, with its usual file name.");
  }
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "TrainingAssignment" WHERE id = ${assignmentId} AND "userId" = ${me.id} FOR UPDATE`;
    const found = await mine(tx, me.id, assignmentId);
    if (!found) return fail("That training is not assigned to you.");
    if (found.row.status !== "ASSIGNED") return fail("This training is already finished.");
    const place = found.version ? lessonPlace(found.version.outline, lessonId) : null;
    const settings = place ? lessonHandIn(place.lesson) : null;
    if (!found.version || !place || !settings) return fail("That lesson is not in your course.");
    const locked = lockedBecause(found, lessonId);
    if (locked) return fail(locked);
    const before = await submissionFor(tx, assignmentId, lessonId);
    if (before?.status === "ACCEPTED") return fail("Your trainer has already accepted this.");
    const keep = work.keepFile && !work.file && !!before?.fileName;
    if (settings.text === "required" && !text) return fail("Write your answer first.");
    if (settings.photo === "required" && !work.file && !keep) return fail("Add a photo or PDF first.");
    if (!text && !work.file && !keep) return fail("Write an answer or add a photo first.");
    // Without a trainer's check, handing it in is enough.
    const status = settings.review ? "SUBMITTED" : "ACCEPTED";
    const file = settings.photo === "off" ? null : work.file;
    const fileData = file
      ? { fileName: safeFileName(file.name), mime: storedMime(file.mime), size: file.bytes.length, bytes: new Uint8Array(file.bytes) }
      : keep && settings.photo !== "off" ? {} : { fileName: null, mime: null, size: null, bytes: null };
    const offline = offlineTime(work.at, found.row.assignedAt);
    const data = { text: settings.text === "off" ? "" : text, ...fileData, status, feedback: "", reviewedById: null, reviewedByName: null, reviewedAt: null, submittedAt: offline ?? new Date(), versionId: found.version.id };
    await tx.trainingSubmission.upsert({
      where: { assignmentId_lessonId: { assignmentId, lessonId } },
      create: { orgId: found.row.orgId, assignmentId, userId: me.id, lessonId, ...data },
      update: data,
    });
    // The first piece of work fixes the version they take, as finishing a lesson does.
    if (!found.row.versionId) await tx.trainingAssignment.update({ where: { id: assignmentId }, data: { versionId: found.version.id } });
    await logAudit({ actorId: me.id, actorName: me.name, action: "hand-in", entity: "TrainingAssignment", entityId: assignmentId,
      summary: `${before ? "Handed in again" : "Handed in"} work for lesson ${place.index + 1}, ${place.lesson.title}${settings.review ? ", for a trainer to check" : ""}${offline ? `, offline at ${offlineLabel(offline)}` : ""}` }, tx);
    return ok();
  });
}

/** The photo or PDF the person handed in, to look at again. */
export async function mySubmissionFile(userId: string, assignmentId: string, lessonId: string) {
  const row = await prisma.trainingSubmission.findFirst({ where: { assignmentId, lessonId, userId }, select: { fileName: true, mime: true, size: true, bytes: true } });
  return row?.bytes && row.fileName && row.mime ? { name: row.fileName, mime: row.mime, size: row.size ?? row.bytes.length, bytes: row.bytes } : null;
}
