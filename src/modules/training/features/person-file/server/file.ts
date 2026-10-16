import "server-only";
import { formatDate, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { PersonFileEntry } from "@/modules/contributions";

/** Training's part of a person's file: what they have to do, and how much they have done.
 *  Registered in module.ts. */
export async function trainingFile(userId: string): Promise<{ summary: string; entries: PersonFileEntry[] }> {
  const [open, done] = await Promise.all([
    prisma.trainingAssignment.findMany({
      where: { userId, status: { in: ["ASSIGNED", "SUBMITTED"] } }, orderBy: [{ dueOn: { sort: "asc", nulls: "last" } }],
      select: { id: true, status: true, dueOn: true, assignedAt: true, course: { select: { title: true } } },
    }),
    prisma.trainingAssignment.count({ where: { userId, status: "COMPLETED" } }),
  ]);
  const now = parseDateOnly(today());
  const overdue = open.filter((a) => a.dueOn && a.dueOn < now).length;
  return {
    summary: `${[open.length ? `${open.length} to do` : "Nothing to do", overdue ? `${overdue} overdue` : null, `${done} completed`].filter(Boolean).join(" · ")}.`,
    entries: open.map((a): PersonFileEntry => ({
      id: a.id,
      title: a.course.title,
      detail: [a.status === "SUBMITTED" ? "Waiting for sign-off" : null, a.dueOn ? `${a.dueOn < now ? "Was due" : "Due"} ${formatDate(a.dueOn)}` : "No deadline"].filter(Boolean).join(" · "),
      on: (a.dueOn ?? a.assignedAt).toISOString().slice(0, 10),
    })),
  };
}

/** Every training assignment this person has had, for HR's subject export. */
export async function trainingRecords(userId: string) {
  return prisma.trainingAssignment.findMany({ where: { userId }, select: { status: true, dueOn: true, assignedAt: true, assignedByName: true, completedAt: true, signedOffByName: true, signoffNote: true, learnerNote: true, cancelReason: true, observation: true, course: { select: { title: true } } } });
}

/** Their in-service hours, sessions and learning paths (phase 5), for HR's subject export. Photo evidence is listed by name, not sent. */
export async function trainingOnTheJobRecords(userId: string) {
  const [hours, sessions, paths, evidence] = await Promise.all([
    prisma.trainingHours.findMany({ where: { userId }, orderBy: { on: "asc" }, select: { on: true, minutes: true, topic: true, typeId: true, recordedByName: true, removedAt: true, removedByName: true } }),
    prisma.trainingSessionPlace.findMany({ where: { userId }, select: { status: true, addedByName: true, markedAt: true, session: { select: { title: true, startsAt: true, minutes: true, location: true, trainerName: true, cancelledAt: true } } } }),
    prisma.trainingPathEnrolment.findMany({ where: { userId }, select: { startsOn: true, enrolledByName: true, cancelledAt: true, path: { select: { title: true } } } }),
    prisma.trainingEvidence.findMany({ where: { userId }, select: { name: true, addedByName: true, createdAt: true, assignment: { select: { course: { select: { title: true } } } } } }),
  ]);
  return { hours, sessions, paths, evidence };
}

/** Their own space in Turnfin Me (phase 6): lesson bookmarks and private notes,
 *  course ratings and refresher practice, for HR's subject export only. Work
 *  never shows these anywhere else. */
export async function trainingLearnerRecords(userId: string) {
  const [notes, feedback, refresherCards, refresherDays] = await Promise.all([
    prisma.trainingLessonNote.findMany({ where: { userId }, select: { lessonId: true, bookmarked: true, note: true, updatedAt: true, assignment: { select: { course: { select: { title: true } } } } } }),
    prisma.trainingFeedback.findMany({ where: { userId }, select: { rating: true, unclear: true, createdAt: true, updatedAt: true, assignment: { select: { course: { select: { title: true } } } } } }),
    prisma.trainingRefresherCard.findMany({ where: { userId }, select: { questionId: true, box: true, dueOn: true, misses: true, lastSeenAt: true, assignment: { select: { course: { select: { title: true } } } } } }),
    prisma.trainingRefresherDay.findMany({ where: { userId }, orderBy: { on: "asc" }, select: { on: true, answered: true, correct: true } }),
  ]);
  return { notes, feedback, refresherCards, refresherDays };
}
