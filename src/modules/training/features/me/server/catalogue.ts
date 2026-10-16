import "server-only";
import { fail, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { qualificationTypesByIds } from "@/lib/qualifications";
import { FILE_SELECT } from "@/modules/training/shared/files";
import { lessonMinutes, outlineLessons, readOutline } from "@/modules/training/shared/lessons";

/** The course catalogue in Turnfin Me (e-learning phase 6): published courses
 *  an author has opened to everyone, which staff may enrol themselves on.
 *  Enrolling is the same assignment a trainer would make, with no due date,
 *  and is audited. Ratings show once three people have rated a course. */

const OPEN = (orgId: string) => ({ orgId, selfEnrol: true, archivedAt: null, publishedVersionId: { not: null } });

export async function catalogueFor(userId: string, orgId: string) {
  const courses = await prisma.trainingCourse.findMany({ where: OPEN(orgId), orderBy: [{ category: "asc" }, { title: "asc" }],
    select: { id: true, title: true, summary: true, category: true, tags: true, coverId: true, requiresSignoff: true, grantsTypeId: true, publishedVersionId: true } });
  if (!courses.length) return [];
  const ids = courses.map((c) => c.id);
  const [versions, mine, ratings, types] = await Promise.all([
    prisma.trainingCourseVersion.findMany({ where: { id: { in: courses.map((c) => c.publishedVersionId!) } }, select: { id: true, outline: true } }),
    prisma.trainingAssignment.findMany({ where: { userId, courseId: { in: ids }, status: { not: "CANCELLED" } }, orderBy: { assignedAt: "desc" }, select: { id: true, courseId: true, status: true } }),
    prisma.trainingFeedback.groupBy({ by: ["courseId"], where: { courseId: { in: ids } }, _avg: { rating: true }, _count: { _all: true } }),
    qualificationTypesByIds(courses.map((c) => c.grantsTypeId)),
  ]);
  const outlines = new Map(versions.map((v) => [v.id, readOutline(v.outline)]));
  return courses.map((c) => {
    const outline = outlines.get(c.publishedVersionId!);
    const lessons = outline ? outlineLessons(outline) : [];
    const rating = ratings.find((r) => r.courseId === c.id);
    const taken = mine.find((m) => m.courseId === c.id && m.status !== "COMPLETED") ?? mine.find((m) => m.courseId === c.id) ?? null;
    return {
      id: c.id, title: c.title, summary: c.summary, category: c.category, tags: c.tags, coverId: c.coverId, requiresSignoff: c.requiresSignoff,
      grants: c.grantsTypeId ? types.get(c.grantsTypeId)?.name ?? null : null,
      lessons: lessons.length, minutes: lessons.reduce((n, l) => n + (lessonMinutes(l) ?? 0), 0), exam: !!outline?.exam && !!outline.questions.length,
      rating: rating && rating._count._all >= 3 ? { average: Math.round((rating._avg.rating ?? 0) * 10) / 10, count: rating._count._all } : null,
      mine: taken && { assignmentId: taken.id, state: taken.status === "COMPLETED" ? "completed" as const : "open" as const },
    };
  });
}

/** A catalogue course's cover picture. Null unless the course is open to all. */
export async function catalogueCover(orgId: string, courseId: string) {
  const course = await prisma.trainingCourse.findFirst({ where: { id: courseId, ...OPEN(orgId) }, select: { coverId: true } });
  if (!course?.coverId) return null;
  return prisma.trainingFile.findFirst({ where: { id: course.coverId, courseId }, select: FILE_SELECT });
}

/** Enrols the person on a catalogue course. Returns the assignment to open,
 *  their existing one when they already have it open. */
export async function enrolMyself(me: { id: string; name: string; orgId: string }, courseId: string): Promise<{ ok: true; assignmentId: string; already: boolean } | Extract<ActionResult, { ok: false }>> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`enrol:${me.id}:${courseId}`}))`;
    const course = await tx.trainingCourse.findFirst({ where: { id: courseId, ...OPEN(me.orgId) }, select: { title: true } });
    if (!course) return fail("That course is not open to enrol on.");
    const open = await tx.trainingAssignment.findFirst({ where: { userId: me.id, courseId, status: { in: ["ASSIGNED", "SUBMITTED"] } }, select: { id: true } });
    if (open) return { ok: true as const, assignmentId: open.id, already: true };
    const row = await tx.trainingAssignment.create({ data: { orgId: me.orgId, courseId, userId: me.id, assignedById: me.id, assignedByName: me.name } });
    await logAudit({ actorId: me.id, actorName: me.name, action: "assign", entity: "TrainingAssignment", entityId: row.id, summary: `Enrolled themselves on ${course.title} from the catalogue (Turnfin Me)` }, tx);
    return { ok: true as const, assignmentId: row.id, already: false };
  });
}
