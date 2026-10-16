import "server-only";
import { staffCardsByIds } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { requireCapFor } from "@/lib/policy/session";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { scopedUserIds } from "@/modules/training/shared/data";
import { lessonPlace, readOutline } from "@/modules/training/shared/lessons";

/** Work handed in on Hand in work lessons (docs/training.md, e-learning phase 8)
 *  that waits for a trainer: for people in the trainer's sign-off reach, never
 *  their own. Shown on the Sign-off page. */

export async function handInQueue() {
  const who = await requireTrainingActor();
  if (!who.signoff) return [];
  const rows = await prisma.trainingSubmission.findMany({
    where: { orgId: who.orgId ?? undefined, status: "SUBMITTED", userId: { ...(await scopedUserIds("training.signoff")), not: who.id }, assignment: { status: "ASSIGNED" } },
    orderBy: { submittedAt: "asc" }, take: 200,
    select: { id: true, userId: true, lessonId: true, versionId: true, text: true, fileName: true, mime: true, submittedAt: true, assignment: { select: { dueOn: true, course: { select: { title: true } } } } },
  });
  const versionIds = [...new Set(rows.map((r) => r.versionId).filter((id): id is string => !!id))];
  const [people, versions] = await Promise.all([
    staffCardsByIds(rows.map((r) => r.userId)),
    versionIds.length ? prisma.trainingCourseVersion.findMany({ where: { id: { in: versionIds } }, select: { id: true, outline: true } }) : [],
  ]);
  const outlines = new Map(versions.map((v) => [v.id, readOutline(v.outline)]));
  return rows.map((r) => {
    const outline = r.versionId ? outlines.get(r.versionId) : undefined;
    const place = outline ? lessonPlace(outline, r.lessonId) : null;
    return {
      id: r.id, text: r.text, fileName: r.fileName, isImage: !!r.mime?.startsWith("image/"), submittedAt: r.submittedAt, dueOn: r.assignment.dueOn,
      course: r.assignment.course.title, lesson: place?.lesson.title ?? "A lesson", task: place?.lesson.body ?? null,
      user: people.get(r.userId) ?? { id: r.userId, name: "Former staff", jobTitle: null },
    };
  });
}
export type HandInRow = Awaited<ReturnType<typeof handInQueue>>[number];

/** A handed-in photo or PDF, for someone who may sign off the person's training. */
export async function handInFile(id: string) {
  const row = await prisma.trainingSubmission.findUnique({ where: { id }, select: { userId: true, orgId: true, fileName: true, mime: true, size: true, bytes: true } });
  if (!row?.bytes || !row.fileName || !row.mime) return null;
  await requireCapFor("training.signoff", { subjectUserId: row.userId, orgId: row.orgId });
  return { name: row.fileName, mime: row.mime, size: row.size ?? row.bytes.length, bytes: row.bytes };
}
