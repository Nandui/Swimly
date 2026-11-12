import "server-only";
import { logAudit } from "@/lib/audit";
import { staffCardsByIds } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { requireCapFor } from "@/lib/policy/session";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { fileProblem, MAX_FILE_BYTES, safeFileName, storedMime } from "@/modules/training/shared/files";
import { readObservation, readObservationRecord } from "@/modules/training/shared/on-the-job";

/** The poolside sign-off (e-learning phase 5): one person's practical, its
 *  checklist and the photos taken as evidence. Needs `training.signoff` for
 *  that person; evidence is read like the rest of their training. */

export class EvidenceError extends Error {}
export const MAX_EVIDENCE = 6;

export async function observationFor(id: string) {
  const who = await requireTrainingActor();
  const row = await prisma.trainingAssignment.findFirst({ where: { id, orgId: who.orgId ?? undefined }, select: {
    id: true, userId: true, orgId: true, status: true, submittedAt: true, learnerNote: true, signoffNote: true, dueOn: true, observation: true,
    course: { select: { id: true, title: true, observation: true } },
    evidence: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, createdAt: true, addedByName: true } },
  } });
  if (!row) return null;
  await requireCapFor("training.signoff", { subjectUserId: row.userId, orgId: row.orgId });
  const person = (await staffCardsByIds([row.userId])).get(row.userId) ?? { id: row.userId, name: "Former staff", jobTitle: null };
  return {
    who, person, own: row.userId === who.id,
    assignment: { id: row.id, status: row.status, submittedAt: row.submittedAt, learnerNote: row.learnerNote, signoffNote: row.signoffNote, dueOn: row.dueOn },
    course: { id: row.course.id, title: row.course.title },
    checklist: readObservation(row.course.observation),
    last: readObservationRecord(row.observation),
    evidence: row.evidence,
  };
}

/** Adds a photo to a practical waiting for sign-off. Pictures only. */
export async function addEvidence(assignmentId: string, file: File) {
  const who = await requireTrainingActor();
  const row = await prisma.trainingAssignment.findFirst({ where: { id: assignmentId, orgId: who.orgId ?? undefined }, select: { userId: true, orgId: true, status: true, course: { select: { title: true } }, _count: { select: { evidence: true } } } });
  if (!row) throw new EvidenceError("That training no longer exists.");
  const actor = await requireCapFor("training.signoff", { subjectUserId: row.userId, orgId: row.orgId });
  if (row.userId === actor.id) throw new EvidenceError("Someone else has to sign off your own training.");
  if (row.status !== "SUBMITTED") throw new EvidenceError("Photos can be added while it waits for sign-off.");
  if (row._count.evidence >= MAX_EVIDENCE) throw new EvidenceError(`Keep it to ${MAX_EVIDENCE} photos.`);
  if (file.size > MAX_FILE_BYTES) throw new EvidenceError("Photos must be no larger than 4 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!storedMime(file.type).startsWith("image/") || fileProblem(file, bytes)) throw new EvidenceError("Use a photo (JPEG, PNG or WebP) up to 4 MB.");
  const name = safeFileName(file.name);
  return prisma.$transaction(async (tx) => {
    const saved = await tx.trainingEvidence.create({ data: { orgId: row.orgId, assignmentId, userId: row.userId, name, mime: storedMime(file.type), size: bytes.length, bytes, addedById: actor.id, addedByName: actor.name }, select: { id: true, name: true, createdAt: true, addedByName: true } });
    const person = (await staffCardsByIds([row.userId], tx)).get(row.userId);
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "create", entity: "TrainingEvidence", entityId: saved.id, summary: `Added a photo as evidence for ${row.course.title}, ${person?.name ?? "former staff"}` }, tx);
    return saved;
  });
}

/** One evidence photo, for anyone whose Training records reach that person. */
export async function readEvidence(id: string) {
  const who = await requireTrainingActor();
  const row = await prisma.trainingEvidence.findFirst({ where: { id, orgId: who.orgId ?? undefined }, select: { userId: true, orgId: true, name: true, mime: true, size: true, bytes: true } });
  if (!row) return null;
  await requireCapFor("training.records.read", { subjectUserId: row.userId, orgId: row.orgId });
  return row;
}
