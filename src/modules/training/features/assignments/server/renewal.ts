import "server-only";
import { filterAllows } from "@/lib/policy/engine";
import { subjectsFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { OPEN_TRAINING_STATUSES } from "@/modules/training/shared/constants";

/** The course that gives each qualification, for Qualifications' expiring list (D26): for each
 *  person and qualification type, the live course that grants it, whether they already have it
 *  open, and whether the reader may assign it to them (`training.assign`). Null when no course
 *  gives that qualification. Training never sees why it is asked. */
export async function renewalCourses(orgId: string | null, rows: readonly { userId: string; typeId: string }[]) {
  const courses = await prisma.trainingCourse.findMany({
    where: { orgId: orgId ?? undefined, archivedAt: null, grantsTypeId: { in: [...new Set(rows.map((r) => r.typeId))] } },
    orderBy: { title: "asc" }, select: { id: true, title: true, grantsTypeId: true },
  });
  const open = courses.length ? await prisma.trainingAssignment.findMany({
    where: { userId: { in: [...new Set(rows.map((r) => r.userId))] }, courseId: { in: courses.map((c) => c.id) }, status: { in: [...OPEN_TRAINING_STATUSES] } },
    select: { userId: true, courseId: true },
  }) : [];
  const assigned = new Set(open.map((a) => `${a.userId}:${a.courseId}`));
  const scope = courses.length ? await subjectsFor("training.assign") : null;
  return (row: { userId: string; typeId: string }) => {
    const course = courses.find((c) => c.grantsTypeId === row.typeId);
    return course ? {
      courseId: course.id, title: course.title, assigned: assigned.has(`${row.userId}:${course.id}`),
      canAssign: !!scope && filterAllows(scope, row.userId),
    } : null;
  };
}
