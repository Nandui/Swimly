import "server-only";
import { prisma } from "@/lib/prisma";
import { hoursOf, pathsOf, sessionsOf } from "@/modules/training/shared/on-the-job-reads";
import { myTraining } from "@/modules/training/features/me/server/mine";

/** My record (e-learning phase 6): every course they have had, with scores
 *  and certificates, their sessions, paths and in-service hours, for Turnfin
 *  Me to show, print and download. Only ever the signed-in person's own. */
export async function myRecord(userId: string, orgId: string | null) {
  const rows = await myTraining(userId);
  const ids = rows.map((r) => r.id);
  const [assignments, attempts, sessions, paths, hours] = await Promise.all([
    prisma.trainingAssignment.findMany({ where: { id: { in: ids } }, select: { id: true, versionId: true, certificateCode: true } }),
    prisma.trainingExamAttempt.findMany({ where: { assignmentId: { in: ids }, submittedAt: { not: null } }, select: { assignmentId: true, percent: true, passed: true } }),
    sessionsOf(userId),
    pathsOf(userId),
    hoursOf(userId, orgId),
  ]);
  const versionIds = [...new Set(assignments.map((a) => a.versionId).filter((id): id is string => !!id))];
  const versions = new Map((versionIds.length ? await prisma.trainingCourseVersion.findMany({ where: { id: { in: versionIds } }, select: { id: true, number: true } }) : []).map((v) => [v.id, v.number]));
  const extra = new Map(assignments.map((a) => [a.id, a]));
  return {
    courses: rows.map((row) => {
      const mine = attempts.filter((a) => a.assignmentId === row.id);
      const best = mine.reduce<number | null>((top, a) => Math.max(top ?? 0, a.percent ?? 0), null);
      const versionId = extra.get(row.id)?.versionId;
      return {
        id: row.id, title: row.course.title, category: row.course.category, state: row.state, assignedAt: row.assignedAt, assignedBy: row.assignedByName, dueOn: row.dueOn,
        completedAt: row.completedAt, signedOffBy: row.signedOffByName, grants: row.course.grantsType?.name ?? null,
        version: versionId ? versions.get(versionId) ?? null : null,
        exam: mine.length ? { attempts: mine.length, best: best ?? 0, passed: mine.some((a) => a.passed) } : null,
        // A certificate can be shown for anything finished; the code is made the first time it is opened.
        certificate: row.state === "completed", certificateCode: extra.get(row.id)?.certificateCode ?? null,
      };
    }),
    sessions: sessions.filter((s) => s.status === "ATTENDED"),
    paths: paths.map((p) => ({ title: p.title, startsOn: p.startsOn, done: p.done, total: p.total, finishedOn: p.finishedOn })),
    hours,
  };
}
