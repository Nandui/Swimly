import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { addDaysIso, parseDateOnly, toDateOnlyString, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { readOutline, type Outline } from "@/modules/training/shared/lessons";
import { cleanAnswer, isCorrect, learnerQuestion, seeded, shuffle, type Question } from "@/modules/training/shared/questions";
import { badgesFor, nextCard, REFRESHER_DAILY, streakOf } from "@/modules/training/shared/learner";
import { hoursOf, pathsOf } from "@/modules/training/shared/on-the-job-reads";
import type { Db } from "@/modules/training/features/me/server/course";

/** Daily two-minute refreshers, streaks and badges (e-learning phase 6), for
 *  Turnfin Me. A practice question the learner missed, or a question from a
 *  passed exam they got wrong, comes back the next day and then further apart
 *  each time they get it right. Days with few due are topped up from courses
 *  they finished. Like practice, only right or not and why is ever sent:
 *  never the right answer. Only ever the signed-in person's own. */

/** Called when a practice answer is wrong: the question comes back tomorrow. Never fails the caller. */
export async function rememberMiss(db: Db, card: { userId: string; assignmentId: string; versionId: string; questionId: string }) {
  const dueOn = parseDateOnly(addDaysIso(today(), 1));
  try {
    await db.trainingRefresherCard.upsert({
      where: { userId_versionId_questionId: { userId: card.userId, versionId: card.versionId, questionId: card.questionId } },
      update: { box: 1, dueOn, misses: { increment: 1 } },
      create: { ...card, box: 1, dueOn },
    });
  } catch { /* a refresher is a bonus: the answer still counts */ }
}

/** A passed exam's wrong answers become refresher cards. A failed one adds none,
 *  so nothing about an exam paper comes out before it is passed. */
export async function rememberExamMisses(db: Db, userId: string, assignmentId: string, versionId: string, results: Record<string, boolean>) {
  for (const [questionId, right] of Object.entries(results)) if (!right) await rememberMiss(db, { userId, assignmentId, versionId, questionId });
}

type Pick = { cardId: string | null; assignmentId: string; versionId: string; questionId: string; course: string; question: Question };

async function outlinesOf(ids: string[]) {
  const versions = ids.length ? await prisma.trainingCourseVersion.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, outline: true } }) : [];
  return new Map(versions.map((v) => [v.id, readOutline(v.outline)]));
}

/** Today's questions: cards due, lowest box first, then questions from finished courses. */
async function todaysPicks(userId: string, on: string, room: number): Promise<Pick[]> {
  if (room <= 0) return [];
  const due = await prisma.trainingRefresherCard.findMany({
    where: { userId, dueOn: { lte: parseDateOnly(on) }, assignment: { userId, status: { not: "CANCELLED" } } },
    orderBy: [{ box: "asc" }, { dueOn: "asc" }], take: 40,
    select: { id: true, assignmentId: true, versionId: true, questionId: true, lastSeenAt: true, assignment: { select: { course: { select: { title: true } } } } },
  });
  const outlines = await outlinesOf(due.map((c) => c.versionId));
  const picks: Pick[] = [];
  for (const card of due) {
    if (picks.length >= room) break;
    if (card.lastSeenAt && today(card.lastSeenAt) === on) continue;
    const question = outlines.get(card.versionId)?.questions.find((q) => q.id === card.questionId);
    if (question) picks.push({ cardId: card.id, assignmentId: card.assignmentId, versionId: card.versionId, questionId: card.questionId, course: card.assignment.course.title, question });
  }
  if (picks.length >= room) return picks;
  // Topped up from finished courses with questions they have not met as a card yet, the same ones all day.
  const finished = await prisma.trainingAssignment.findMany({ where: { userId, status: "COMPLETED", versionId: { not: null } }, orderBy: { completedAt: "desc" }, take: 20,
    select: { id: true, versionId: true, course: { select: { title: true } } } });
  if (!finished.length) return picks;
  const [finishedOutlines, carded] = await Promise.all([
    outlinesOf(finished.map((a) => a.versionId!)),
    prisma.trainingRefresherCard.findMany({ where: { userId, versionId: { in: finished.map((a) => a.versionId!) } }, select: { versionId: true, questionId: true } }),
  ]);
  const seen = new Set(carded.map((c) => `${c.versionId}:${c.questionId}`));
  const pool = finished.flatMap((a) => (finishedOutlines.get(a.versionId!)?.questions ?? [])
    .filter((q) => !seen.has(`${a.versionId}:${q.id}`))
    .map((q) => ({ cardId: null, assignmentId: a.id, versionId: a.versionId!, questionId: q.id, course: a.course.title, question: q })));
  return [...picks, ...shuffle(pool, seeded(`${userId}:${on}:top-up`)).slice(0, room - picks.length)];
}

async function dayRow(userId: string, on: string) {
  return prisma.trainingRefresherDay.findUnique({ where: { userId_on: { userId, on: parseDateOnly(on) } }, select: { answered: true, correct: true } });
}

/** Days with some learning: a lesson finished or a refresher answered, over the last year and a bit. */
async function learningDays(userId: string, on: string) {
  const since = parseDateOnly(addDaysIso(on, -400));
  const [days, lessons] = await Promise.all([
    prisma.trainingRefresherDay.findMany({ where: { userId, on: { gte: since }, answered: { gt: 0 } }, select: { on: true } }),
    prisma.trainingLessonProgress.findMany({ where: { assignment: { userId }, completedAt: { gte: since } }, select: { completedAt: true } }),
  ]);
  return [...days.map((d) => toDateOnlyString(d.on)), ...lessons.map((l) => today(l.completedAt))];
}

/** Today's refresher, the streak and every badge with whether it is earned. */
export async function myRefresher(userId: string, orgId: string | null) {
  const on = today();
  const day = await dayRow(userId, on);
  const answered = day?.answered ?? 0;
  const [picks, days, stats] = await Promise.all([todaysPicks(userId, on, REFRESHER_DAILY - answered), learningDays(userId, on), learnerStats(userId, orgId)]);
  const streak = streakOf(days, on);
  return {
    on, goal: REFRESHER_DAILY, answered, correct: day?.correct ?? 0, streak: { current: streak.current, best: Math.max(streak.best, 0), today: streak.today },
    questions: picks.map((p) => ({ cardId: p.cardId, assignmentId: p.assignmentId, questionId: p.questionId, course: p.course,
      question: learnerQuestion(p.question, seeded(`${userId}:${on}:${p.questionId}`)) })),
    badges: badgesFor({ ...stats, bestStreak: streak.best }),
  };
}

/** How many questions are waiting today, for Me's home and training list. */
export async function refresherWaiting(userId: string) {
  const on = today();
  const day = await dayRow(userId, on);
  const room = REFRESHER_DAILY - (day?.answered ?? 0);
  if (room <= 0) return 0;
  return (await todaysPicks(userId, on, room)).length;
}

/** Checks a refresher answer and moves the card along. Null when the question isn't theirs to answer today. */
export async function answerRefresher(userId: string, ref: { cardId?: string; assignmentId?: string; questionId?: string }, raw: unknown) {
  const on = today();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refresher:${userId}`}))`;
    const day = await tx.trainingRefresherDay.findUnique({ where: { userId_on: { userId, on: parseDateOnly(on) } }, select: { answered: true } });
    if ((day?.answered ?? 0) >= REFRESHER_DAILY) return { done: true as const };
    let card: { id: string; box: number; versionId: string; questionId: string; assignmentId: string; lastSeenAt: Date | null } | null = null;
    let versionId: string, questionId: string, assignmentId: string;
    if (ref.cardId) {
      const found = await tx.trainingRefresherCard.findFirst({ where: { id: ref.cardId, userId, assignment: { status: { not: "CANCELLED" } } },
        select: { id: true, box: true, dueOn: true, versionId: true, questionId: true, assignmentId: true, lastSeenAt: true } });
      if (!found) return null;
      if (found.lastSeenAt && today(found.lastSeenAt) === on) return { done: true as const };
      if (toDateOnlyString(found.dueOn) > on) return null;
      card = found;
      ({ versionId, questionId, assignmentId } = card);
    } else {
      // A top-up: only from a course they finished.
      const finished = ref.assignmentId ? await tx.trainingAssignment.findFirst({ where: { id: ref.assignmentId, userId, status: "COMPLETED" }, select: { id: true, versionId: true } }) : null;
      if (!finished?.versionId || !ref.questionId) return null;
      card = await tx.trainingRefresherCard.findUnique({ where: { userId_versionId_questionId: { userId, versionId: finished.versionId, questionId: ref.questionId } },
        select: { id: true, box: true, versionId: true, questionId: true, assignmentId: true, lastSeenAt: true } });
      if (card) return { done: true as const };
      ({ versionId, questionId, assignmentId } = { versionId: finished.versionId, questionId: ref.questionId, assignmentId: finished.id });
    }
    const version = await tx.trainingCourseVersion.findUnique({ where: { id: versionId }, select: { outline: true } });
    const question = version ? (readOutline(version.outline) as Outline).questions.find((q) => q.id === questionId) : null;
    if (!question) return null;
    const correct = isCorrect(question, cleanAnswer(question, raw));
    // A top-up answered right starts one box up; wrong, it comes back tomorrow.
    const moved = nextCard(card?.box ?? 1, correct, on);
    const data = { box: moved.box, dueOn: parseDateOnly(moved.dueOn), lastSeenAt: new Date() } satisfies Prisma.TrainingRefresherCardUpdateInput;
    if (card) await tx.trainingRefresherCard.update({ where: { id: card.id }, data: { ...data, misses: correct ? undefined : { increment: 1 } } });
    else await tx.trainingRefresherCard.create({ data: { userId, assignmentId, versionId, questionId, ...data, misses: correct ? 0 : 1 } });
    await tx.trainingRefresherDay.upsert({ where: { userId_on: { userId, on: parseDateOnly(on) } },
      update: { answered: { increment: 1 }, correct: correct ? { increment: 1 } : undefined }, create: { userId, on: parseDateOnly(on), answered: 1, correct: correct ? 1 : 0 } });
    return { done: false as const, correct, explanation: question.explanation, nextIn: daysBetween(on, moved.dueOn) };
  });
}

const daysBetween = (from: string, to: string) => Math.round((parseDateOnly(to).getTime() - parseDateOnly(from).getTime()) / 86_400_000);

/** What the badges are worked out from. */
async function learnerStats(userId: string, orgId: string | null) {
  const [done, attempts, answers, hours, paths] = await Promise.all([
    prisma.trainingAssignment.count({ where: { userId, status: "COMPLETED" } }),
    prisma.trainingExamAttempt.findMany({ where: { assignment: { userId }, submittedAt: { not: null } }, select: { number: true, passed: true, percent: true } }),
    prisma.trainingRefresherDay.aggregate({ where: { userId }, _sum: { answered: true } }),
    hoursOf(userId, orgId),
    pathsOf(userId),
  ]);
  return {
    coursesDone: done,
    perfectExam: attempts.some((a) => a.passed && a.percent === 100),
    firstTimePass: attempts.some((a) => a.passed && a.number === 1),
    refresherAnswers: answers._sum.answered ?? 0,
    hoursMet: hours.progress.some((h) => h.met),
    pathDone: paths.some((p) => !!p.finishedOn),
  };
}
