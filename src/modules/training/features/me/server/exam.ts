import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  cleanAnswer, drawPaper, GRACE_SECONDS, isCorrect, learnerQuestion, markPaper, matchPartners, paperSize, rightAnswer, seeded, type Answer, type Question,
} from "@/modules/training/shared/questions";
import { docChecks, outlineLessons, readOutline } from "@/modules/training/shared/lessons";
import { finishAssignment, mine, type Db } from "@/modules/training/features/me/server/course";

/** Quizzes and the final exam in Turnfin Me (docs/training.md, e-learning
 *  phase 2). Only ever the signed-in person's own assignment. The key never
 *  leaves this file: learners get `learnerQuestion`, and a review with the
 *  right answers only after a passed exam. Every sitting is audited. */

type Person = { id: string; name: string };
type Found = NonNullable<Awaited<ReturnType<typeof mine>>>;

const ATTEMPT = { id: true, number: true, versionId: true, paper: true, answers: true, startedAt: true, deadlineAt: true, submittedAt: true, correct: true, total: true, percent: true, passed: true, results: true } as const satisfies Prisma.TrainingExamAttemptSelect;
type Attempt = Prisma.TrainingExamAttemptGetPayload<{ select: typeof ATTEMPT }>;

const paperOf = (attempt: Pick<Attempt, "paper">) => (Array.isArray(attempt.paper) ? attempt.paper : []).filter((id): id is string => typeof id === "string");
const answersOf = (attempt: Pick<Attempt, "answers">) => (attempt.answers && typeof attempt.answers === "object" && !Array.isArray(attempt.answers) ? attempt.answers : {}) as Record<string, unknown>;
/** Past the time limit and the grace for answers already on their way. */
const expired = (attempt: Pick<Attempt, "deadlineAt">, now = new Date()) => !!attempt.deadlineAt && now.getTime() > attempt.deadlineAt.getTime() + GRACE_SECONDS * 1000;

// ---------------------------------------------------------------------------
// Quiz lessons: practice, never marked or stored beyond finishing the lesson
// ---------------------------------------------------------------------------

/** Checks one practice answer. The explanation comes with a right answer, or
 *  when the learner gives up on it; the right answer itself never does. */
export async function checkQuizAnswer(userId: string, assignmentId: string, lessonId: string, questionId: string, raw: unknown, giveUp: boolean) {
  const found = await mine(prisma, userId, assignmentId);
  const outline = found?.version?.outline;
  // A Quiz lesson practises its own section's questions; any lesson may ask the
  // questions its knowledge checks name.
  const lesson = outline ? outlineLessons(outline).find((l) => l.id === lessonId) : null;
  const section = lesson?.kind === "QUIZ" ? outline!.sections.find((s) => s.lessons.includes(lesson)) : null;
  const question = lesson ? outline!.questions.find((q) => q.id === questionId && (q.sectionId === section?.id || docChecks(lesson.body).includes(q.id))) : null;
  if (!question) return null;
  const correct = isCorrect(question, cleanAnswer(question, raw));
  return { correct, explanation: correct || giveUp ? question.explanation : "" };
}

// ---------------------------------------------------------------------------
// The final exam
// ---------------------------------------------------------------------------

/** Submits an attempt whose time ran out, with the answers it had. */
async function closeExpired(tx: Db, me: Person, found: Found, attempts: Attempt[]) {
  const open = attempts.find((a) => !a.submittedAt);
  if (!open || !expired(open) || !found.version?.outline.exam) return attempts;
  await submitAttempt(tx, me, found, open, "Time ran out on");
  return tx.trainingExamAttempt.findMany({ where: { assignmentId: found.row.id }, orderBy: { number: "asc" }, select: ATTEMPT });
}

function examSummary(found: Found, attempts: Attempt[]) {
  const outline = found.version?.outline;
  const exam = outline?.exam;
  if (!outline || !exam || !outline.questions.length) return null;
  const allowed = exam.attempts + found.row.examExtraAttempts;
  const used = attempts.length;
  const passed = attempts.some((a) => a.passed);
  const open = attempts.find((a) => !a.submittedAt) ?? null;
  const lessonsDone = outlineLessons(outline).every((l) => found.done.has(l.id));
  const assigned = found.row.status === "ASSIGNED";
  const reason = !assigned ? "This training is finished." : passed ? "You have passed the exam." : used >= allowed && !open ? "You have used every attempt. Your trainer can give you another."
    : !lessonsDone && !exam.testOut ? "Finish the lessons first." : null;
  return {
    questions: paperSize(exam, outline.questions.length), passMark: exam.passMark, timeLimit: exam.timeLimit, testOut: exam.testOut,
    attempts: { allowed, used, left: Math.max(0, allowed - used) },
    passed, lessonsDone, canStart: !reason || !!open, reason: open ? null : reason,
    open: open && { id: open.id, number: open.number, deadlineAt: open.deadlineAt?.toISOString() ?? null, answered: Object.keys(answersOf(open)).length, total: open.total },
    history: attempts.filter((a) => a.submittedAt).map((a) => ({ number: a.number, submittedAt: a.submittedAt!.toISOString(), correct: a.correct ?? 0, total: a.total, percent: a.percent ?? 0, passed: !!a.passed })),
  };
}
export type ExamSummary = NonNullable<ReturnType<typeof examSummary>>;

/** The learner's assignment and attempts, read without locking. An attempt
 *  whose time has run out is handed in first, under the assignment's lock. */
async function current(me: Person, assignmentId: string) {
  const found = await mine(prisma, me.id, assignmentId);
  if (!found) return null;
  const attempts = await prisma.trainingExamAttempt.findMany({ where: { assignmentId }, orderBy: { number: "asc" }, select: ATTEMPT });
  const open = attempts.find((a) => !a.submittedAt);
  if (!open || !expired(open)) return { found, attempts };
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "TrainingAssignment" WHERE id = ${assignmentId} AND "userId" = ${me.id} FOR UPDATE`;
    const locked = await mine(tx, me.id, assignmentId);
    if (!locked) return null;
    const fresh = await tx.trainingExamAttempt.findMany({ where: { assignmentId }, orderBy: { number: "asc" }, select: ATTEMPT });
    return { found: locked, attempts: await closeExpired(tx, me, locked, fresh) };
  });
}

/** The exam's rules and how the learner has done, or null for a course without one. */
export async function myExam(me: Person, assignmentId: string) {
  const now = await current(me, assignmentId);
  return now ? examSummary(now.found, now.attempts) : null;
}

/** The open paper: its questions without the key, in this person's order, with the answers saved so far. */
function paperView(found: Found, attempt: Attempt) {
  const questions = new Map(found.version!.outline.questions.map((q) => [q.id, q]));
  const random = seeded(attempt.id);
  const saved = answersOf(attempt);
  return {
    id: attempt.id, number: attempt.number, deadlineAt: attempt.deadlineAt?.toISOString() ?? null,
    questions: paperOf(attempt).map((id) => questions.get(id)).filter((q): q is Question => !!q).map((q) => ({ ...learnerQuestion(q, random), answer: (saved[q.id] ?? null) as Answer | null })),
  };
}

/** Starts a sitting, or returns the one already open. The first sitting fixes
 *  the course version, like the first lesson does. */
export async function startExam(me: Person, assignmentId: string): Promise<ActionResult | { ok: true; paper: ReturnType<typeof paperView> }> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "TrainingAssignment" WHERE id = ${assignmentId} AND "userId" = ${me.id} FOR UPDATE`;
    const found = await mine(tx, me.id, assignmentId);
    if (!found) return fail("That training is not assigned to you.");
    let attempts = await tx.trainingExamAttempt.findMany({ where: { assignmentId }, orderBy: { number: "asc" }, select: ATTEMPT });
    attempts = await closeExpired(tx, me, found, attempts);
    const summary = examSummary(found, attempts);
    if (!summary || !found.version) return fail("This course has no exam.");
    const open = attempts.find((a) => !a.submittedAt);
    if (open) return { ok: true as const, paper: paperView(found, open) };
    if (summary.reason) return fail(summary.reason);
    const exam = found.version.outline.exam!;
    const number = (attempts.at(-1)?.number ?? 0) + 1;
    const id = crypto.randomUUID();
    const paper = drawPaper(exam, found.version.outline.questions, seeded(`${id}:paper`));
    const now = new Date();
    if (!found.row.versionId) await tx.trainingAssignment.update({ where: { id: assignmentId }, data: { versionId: found.version.id } });
    const attempt = await tx.trainingExamAttempt.create({ data: {
      id, assignmentId, versionId: found.version.id, number, paper, total: paper.length, startedAt: now,
      deadlineAt: exam.timeLimit ? new Date(now.getTime() + exam.timeLimit * 60_000) : null,
    }, select: ATTEMPT });
    await logAudit({ actorId: me.id, actorName: me.name, action: "update", entity: "TrainingAssignment", entityId: assignmentId,
      summary: `Started attempt ${number} of the final exam (${paper.length} questions${exam.timeLimit ? `, ${exam.timeLimit} minutes` : ""})` }, tx);
    return { ok: true as const, paper: paperView(found, attempt) };
  });
}

/** The open paper, for coming back to it. Null when none is open. */
export async function myExamPaper(me: Person, assignmentId: string) {
  const now = await current(me, assignmentId);
  const open = now?.found.version ? now.attempts.find((a) => !a.submittedAt) : null;
  return open ? paperView(now!.found, open) : null;
}

/** Saves one answer as the learner goes, so nothing is lost if the phone sleeps. */
export async function saveExamAnswer(me: Person, assignmentId: string, attemptId: string, questionId: string, raw: unknown): Promise<ActionResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "training_exam_attempts" WHERE id = ${attemptId} FOR UPDATE`;
    const found = await mine(tx, me.id, assignmentId);
    const attempt = found ? await tx.trainingExamAttempt.findFirst({ where: { id: attemptId, assignmentId }, select: ATTEMPT }) : null;
    if (!found?.version || !attempt) return fail("That exam is not yours.");
    if (attempt.submittedAt) return fail("This attempt has been handed in.");
    if (expired(attempt)) return fail("Time is up for this attempt.");
    const question = paperOf(attempt).includes(questionId) ? found.version.outline.questions.find((q) => q.id === questionId) : null;
    if (!question) return fail("That question is not on your paper.");
    const answer = raw === null ? null : cleanAnswer(question, raw);
    if (raw !== null && answer === null) return fail("That answer could not be read. Choose again.");
    const answers = { ...answersOf(attempt) };
    if (answer === null) delete answers[questionId]; else answers[questionId] = answer;
    await tx.trainingExamAttempt.update({ where: { id: attemptId }, data: { answers: answers as Prisma.InputJsonValue } });
    return ok();
  });
}

/** Marks an attempt. A pass finishes the course when its lessons are done (or
 *  it allows testing out), straight into sign-off for a practical course. */
async function submitAttempt(tx: Db, me: Person, found: Found, attempt: Attempt, verb = "Handed in") {
  const outline = found.version!.outline;
  const mark = markPaper(outline.exam!, outline.questions, paperOf(attempt), answersOf(attempt));
  await tx.trainingExamAttempt.update({ where: { id: attempt.id }, data: {
    submittedAt: new Date(), correct: mark.correct, total: mark.total, percent: mark.percent, passed: mark.passed, results: mark.results,
  } });
  await logAudit({ actorId: me.id, actorName: me.name, action: "update", entity: "TrainingAssignment", entityId: found.row.id,
    summary: `${verb} attempt ${attempt.number} of the final exam: ${mark.correct} of ${mark.total} (${mark.percent}%), ${mark.passed ? "passed" : "not passed"}` }, tx);
  const lessonsDone = outlineLessons(outline).every((l) => found.done.has(l.id));
  if (mark.passed && found.row.status === "ASSIGNED" && (lessonsDone || outline.exam!.testOut)) {
    await finishAssignment(tx, me, found.row.id, "", found.version!.id);
  }
  return mark;
}

export async function submitExam(me: Person, assignmentId: string, attemptId: string): Promise<ActionResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "TrainingAssignment" WHERE id = ${assignmentId} AND "userId" = ${me.id} FOR UPDATE`;
    const found = await mine(tx, me.id, assignmentId);
    const attempt = found ? await tx.trainingExamAttempt.findFirst({ where: { id: attemptId, assignmentId }, select: ATTEMPT }) : null;
    if (!found?.version?.outline.exam || !attempt) return fail("That exam is not yours.");
    if (attempt.submittedAt) return ok();
    await submitAttempt(tx, me, found, attempt);
    return ok();
  });
}

/** One handed-in attempt. After a pass: every question with the learner's
 *  answer, the right one and why. After a fail: the score and the sections to
 *  go back over, never the answers. */
export async function myExamResult(userId: string, assignmentId: string, number: number) {
  const found = await mine(prisma, userId, assignmentId);
  const attempt = found ? await prisma.trainingExamAttempt.findFirst({ where: { assignmentId, number }, select: ATTEMPT }) : null;
  if (!found || !attempt?.submittedAt) return null;
  const version = attempt.versionId === found.version?.id ? found.version : await prisma.trainingCourseVersion.findUnique({ where: { id: attempt.versionId }, select: { id: true, outline: true } })
    .then((v) => v && { id: v.id, outline: readOutline(v.outline) });
  if (!version) return null;
  const outline = version.outline;
  const results = (attempt.results ?? {}) as Record<string, boolean>;
  const questions = new Map(outline.questions.map((q) => [q.id, q]));
  const paper = paperOf(attempt).map((id) => questions.get(id)).filter((q): q is Question => !!q);
  const missedSections = [...new Set(paper.filter((q) => !results[q.id]).map((q) => q.sectionId))]
    .map((id) => outline.sections.find((s) => s.id === id)).filter((s) => !!s).map((s) => ({ id: s.id, title: s.title, firstLessonId: s.lessons[0]?.id ?? null }));
  const saved = answersOf(attempt);
  const random = seeded(attempt.id);
  return {
    number: attempt.number, submittedAt: attempt.submittedAt.toISOString(), correct: attempt.correct ?? 0, total: attempt.total, percent: attempt.percent ?? 0,
    passed: !!attempt.passed, passMark: outline.exam?.passMark ?? null,
    revisit: attempt.passed ? [] : missedSections,
    review: attempt.passed ? paper.map((q) => {
      const view = learnerQuestion(q, random);
      return { ...view, options: q.kind === "ORDER" || q.kind === "TRUE_FALSE" ? q.options.map((o) => ({ id: o.id, text: o.text, imageId: o.imageId })) : view.options,
        partners: q.kind === "MATCH" ? matchPartners(q) : null,
        yours: (saved[q.id] ?? null) as Answer | null, right: rightAnswer(q), correct: !!results[q.id], explanation: q.explanation };
    }) : null,
  };
}
