import "server-only";
import { activeStaffWithRoles, staffCardsByIds } from "@/lib/directory";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { subjectsFor } from "@/lib/policy/session";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { people } from "@/modules/training/shared/data";
import { pathProgress } from "@/modules/training/shared/on-the-job";

/** Learning paths for the Training workspace (phase 5). Anyone with Training
 *  access sees the paths; who is on one is limited to the people their
 *  records reach. */

export async function listPaths() {
  const who = await requireTrainingActor();
  const reach = await subjectsFor("training.records.read");
  const rows = await prisma.trainingPath.findMany({
    where: { orgId: who.orgId ?? undefined },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { title: "asc" }],
    select: { id: true, title: true, summary: true, archivedAt: true, steps: { orderBy: { position: "asc" }, select: { dueDays: true, course: { select: { title: true } } } },
      _count: { select: { enrolments: { where: { cancelledAt: null, userId: people(reach) } } } } },
  });
  return { who, paths: rows.map((p) => ({ id: p.id, title: p.title, summary: p.summary, archived: !!p.archivedAt, courses: p.steps.map((s) => s.course.title), days: Math.max(0, ...p.steps.map((s) => s.dueDays)), enrolled: p._count.enrolments })) };
}

export async function pathDetail(pathId: string) {
  const who = await requireTrainingActor();
  const path = await prisma.trainingPath.findFirst({ where: { id: pathId, orgId: who.orgId ?? undefined }, select: {
    id: true, title: true, summary: true, archivedAt: true, createdByName: true,
    steps: { orderBy: { position: "asc" }, select: { courseId: true, dueDays: true, course: { select: { title: true, requiresSignoff: true, archivedAt: true } } } },
  } });
  if (!path) return null;
  const reach = await subjectsFor("training.records.read");
  const enrolments = await prisma.trainingPathEnrolment.findMany({ where: { pathId, cancelledAt: null, userId: people(reach) }, orderBy: { startsOn: "desc" }, select: { id: true, userId: true, startsOn: true, enrolledByName: true } });
  const userIds = enrolments.map((e) => e.userId);
  const [history, cards, courses, assignable] = await Promise.all([
    prisma.trainingAssignment.findMany({ where: { userId: { in: userIds }, courseId: { in: path.steps.map((s) => s.courseId) }, status: { not: "CANCELLED" } }, select: { userId: true, courseId: true, status: true, dueOn: true, completedAt: true } }),
    staffCardsByIds(userIds),
    prisma.trainingCourse.findMany({ where: { orgId: who.orgId ?? undefined, archivedAt: null }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    who.assign ? activeStaffWithRoles(who.orgId ?? null, await subjectsFor("training.assign")) : Promise.resolve([]),
  ]);
  const on = parseDateOnly(today());
  const steps = path.steps.map((s) => ({ courseId: s.courseId, dueDays: s.dueDays }));
  const rows = enrolments.map((e) => {
    const progress = pathProgress(steps, history.filter((h) => h.userId === e.userId), on);
    return { id: e.id, userId: e.userId, name: cards.get(e.userId)?.name ?? "Former staff", jobTitle: cards.get(e.userId)?.jobTitle ?? null, startsOn: e.startsOn, enrolledByName: e.enrolledByName, ...progress };
  });
  return {
    who, path: { id: path.id, title: path.title, summary: path.summary, archived: !!path.archivedAt, createdByName: path.createdByName },
    steps: path.steps.map((s) => ({ courseId: s.courseId, title: s.course.title, dueDays: s.dueDays, practical: s.course.requiresSignoff, archived: !!s.course.archivedAt })),
    rows, courses, assignable,
    summary: { enrolled: rows.length, finished: rows.filter((r) => r.finishedOn).length, overdue: rows.filter((r) => r.overdue).length },
  };
}
