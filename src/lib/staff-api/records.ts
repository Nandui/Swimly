import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { acknowledgeReviewFor, hrConfigured, logOwnHrRead, mySharedHr } from "@/modules/hr";
import { myQualifications } from "@/lib/people/mine";
import { myDays } from "@/modules/rota";
import { docsReading } from "@/modules/docs";
import {
  checkQuizAnswer, completeLessonFor, completeTrainingFor, myCertificate, myCourse, myCourseFile, myExam, myExamPaper, myExamResult, myLesson, myPlan, myPractical, myTraining,
  saveExamAnswer, startExam, submitExam, trainingFileResponse,
  handInWork, HAND_IN_TYPES, MAX_HAND_IN_TEXT, mySubmissionFile,
  answerRefresher, catalogueCover, catalogueFor, enrolMyself, myFeedback, myLessonNote, myRecord, myRefresher, mySaved, rateCourse, refresherWaiting, saveLessonNote, searchMyTraining,
} from "@/modules/training";
import { StaffApiError, notFound } from "@/lib/staff-api/errors";
import { idSchema, parseInput, readBody } from "@/lib/staff-api/http";
import { rateLimit } from "@/lib/staff-api/security";
import { requireConfirmed, type StaffIdentity } from "@/lib/staff-api/auth";

/** Everything Turnfin Me can read or do, for the signed-in person only. Every
 *  response is built field by field from an allowlist: no swimmers, refunds,
 *  other staff, permissions or internal notes ever leave through here. */

const date = (value: Date | null | undefined) => (value ? value.toISOString().slice(0, 10) : null);
const failed = (message: string) => new StaffApiError(409, "NOT_POSSIBLE", message);

// ---------------------------------------------------------------------------
// Me and my details
// ---------------------------------------------------------------------------

const DETAIL_FIELDS = ["phone", "homeAddress", "emergencyName", "emergencyPhone", "emergencyRelationship"] as const;

export async function profile(identity: StaffIdentity) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: identity.user.id }, select: {
    name: true, email: true, jobTitle: true, primaryClubId: true,
    phone: true, homeAddress: true, emergencyName: true, emergencyPhone: true, emergencyRelationship: true,
  } });
  const [site, pending] = await Promise.all([
    user.primaryClubId ? prisma.club.findUnique({ where: { id: user.primaryClubId }, select: { name: true } }) : null,
    prisma.staffDetailChangeRequest.findFirst({ where: { userId: identity.user.id, status: "PENDING" }, orderBy: { createdAt: "desc" }, select: { proposed: true, createdAt: true } }),
  ]);
  const latest = await prisma.staffDetailChangeRequest.findFirst({
    where: { userId: identity.user.id, status: { in: ["APPLIED", "DECLINED"] } }, orderBy: { reviewedAt: "desc" }, select: { status: true, reply: true, reviewedAt: true },
  });
  return {
    name: user.name, email: user.email, jobTitle: user.jobTitle ?? "", site: site?.name ?? null,
    details: Object.fromEntries(DETAIL_FIELDS.map((f) => [f, user[f] ?? ""])),
    pendingChange: pending ? { proposed: pending.proposed, sentAt: pending.createdAt.toISOString() } : null,
    lastDecision: latest ? { status: latest.status, reply: latest.reply, decidedAt: latest.reviewedAt?.toISOString() ?? null } : null,
  };
}

const text = (max: number) => z.string().trim().max(max);
const detailsSchema = z.object({
  phone: text(40).optional(),
  homeAddress: text(300).optional(),
  emergencyName: text(120).optional(),
  emergencyPhone: text(40).optional(),
  emergencyRelationship: text(60).optional(),
  message: text(500).default(""),
}).strict().refine((v) => DETAIL_FIELDS.some((f) => v[f] !== undefined), "Include at least one detail to change.");

export async function requestDetailsChange(request: Request, identity: StaffIdentity) {
  const input = await readBody(request, detailsSchema);
  await rateLimit(`details:${identity.user.id}`, 10, 3600);
  if (await prisma.staffDetailChangeRequest.count({ where: { userId: identity.user.id, status: "PENDING" } })) {
    throw failed("You already have changes waiting for review. You can send more once they are done.");
  }
  const { message, ...fields } = input;
  const proposed = Object.fromEntries(DETAIL_FIELDS.filter((f) => fields[f] !== undefined).map((f) => [f, fields[f] as string]));
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.staffDetailChangeRequest.create({ data: { orgId: identity.user.orgId, userId: identity.user.id, proposed, message } });
    // Names the fields, never the values.
    await logAudit({ actorId: identity.user.id, actorName: identity.user.name, action: "request-details-change", entity: "User", entityId: identity.user.id,
      summary: `Asked to change their ${Object.keys(proposed).join(", ")} (Turnfin Me)`, details: { requestId: created.id } }, tx);
    return created;
  });
  return { id: row.id, status: row.status, sentAt: row.createdAt.toISOString() };
}

// ---------------------------------------------------------------------------
// Qualifications and certificate uploads
// ---------------------------------------------------------------------------

export async function qualifications(identity: StaffIdentity) {
  const [held, uploads, types] = await Promise.all([
    myQualifications(identity.user.id),
    prisma.qualificationEvidence.findMany({ where: { userId: identity.user.id }, orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, typeId: true, typeName: true, status: true, reviewNote: true, createdAt: true, fileName: true } }),
    prisma.qualificationType.findMany({ where: { orgId: identity.user.orgId, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  return {
    items: held.map((q) => ({ id: q.id, name: q.type.name, issuedOn: date(q.issuedOn), expiresOn: date(q.expiresOn), state: q.state, reference: q.reference })),
    uploads: uploads.map((u) => ({ id: u.id, name: u.typeId ? typeName.get(u.typeId) ?? u.typeName : u.typeName, status: u.status, note: u.reviewNote, sentAt: u.createdAt.toISOString(), fileName: u.fileName })),
    types,
  };
}

const MIME = { "application/pdf": [0x25, 0x50, 0x44, 0x46], "image/png": [0x89, 0x50, 0x4e, 0x47], "image/jpeg": [0xff, 0xd8, 0xff] } as const;
const uploadSchema = z.object({
  typeId: z.string().max(64).optional(),
  typeName: text(120).optional(),
  issuedOn: z.string().refine(isDateOnly, "Use a date.").optional(),
  /** The one date a certificate must give (owner decision, 9 October 2026). */
  expiresOn: z.string().refine(isDateOnly, "Give the expiry date on the certificate."),
  reference: text(80).default(""),
  fileName: z.string().trim().min(1).max(120).regex(/^[^/\\\r\n]+$/, "Use a plain file name."),
  mime: z.enum(Object.keys(MIME) as [keyof typeof MIME]),
  data: z.string().min(4).max(7_200_000),
}).strict().refine((v) => v.typeId || v.typeName, "Say which qualification it is.");

export async function uploadEvidence(request: Request, identity: StaffIdentity) {
  const input = await readBody(request, uploadSchema, 7_400_000);
  await rateLimit(`upload:${identity.user.id}`, 20, 86400);
  const bytes = Buffer.from(input.data, "base64");
  if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) throw new StaffApiError(413, "BODY_TOO_LARGE", "Files can be up to 5 MB.");
  if (!MIME[input.mime].every((b, i) => bytes[i] === b)) throw new StaffApiError(400, "INVALID_REQUEST", "That file does not look like a PDF, PNG or JPEG.");
  if (input.issuedOn && input.expiresOn && input.expiresOn < input.issuedOn) throw new StaffApiError(400, "INVALID_REQUEST", "The expiry date is before the issue date.");
  const type = input.typeId ? await prisma.qualificationType.findFirst({ where: { id: input.typeId, orgId: identity.user.orgId, archivedAt: null }, select: { id: true, name: true } }) : null;
  if (input.typeId && !type) notFound();
  if (await prisma.qualificationEvidence.count({ where: { userId: identity.user.id, status: "PENDING" } }) >= 10) {
    throw failed("You have ten certificates waiting to be checked. Send more once those are done.");
  }
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.qualificationEvidence.create({ data: {
      orgId: identity.user.orgId, userId: identity.user.id, typeId: type?.id ?? null, typeName: type?.name ?? input.typeName ?? "",
      issuedOn: input.issuedOn ? parseDateOnly(input.issuedOn) : null, expiresOn: parseDateOnly(input.expiresOn),
      reference: input.reference, fileName: input.fileName, mime: input.mime, size: bytes.length, bytes,
    } });
    await logAudit({ actorId: identity.user.id, actorName: identity.user.name, action: "upload-certificate", entity: "Qualification", entityId: created.id,
      summary: `Sent a ${type?.name ?? input.typeName} certificate to be checked (Turnfin Me)` }, tx);
    return created;
  });
  return { id: row.id, status: row.status };
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

type TrainingRow = Awaited<ReturnType<typeof myTraining>>[number];
const trainingDto = (row: TrainingRow) => ({
  id: row.id, title: row.course.title, summary: row.course.summary, state: row.state, requiresSignoff: row.course.requiresSignoff,
  grants: row.course.grantsType?.name ?? null, dueOn: date(row.dueOn), assignedBy: row.assignedByName, assignedAt: row.assignedAt.toISOString(),
  completedAt: row.completedAt?.toISOString() ?? null, signedOffBy: row.signedOffByName, trainerNote: row.signoffNote,
  // A course built from lessons: how far through, and the lesson to continue with.
  progress: row.progress && { done: row.progress.done, total: row.progress.total, nextLessonId: row.progress.nextLessonId },
  // Its cover picture (fetched from the course's files) and catalogue category.
  coverId: row.course.coverId, category: row.course.category,
});

export async function training(identity: StaffIdentity) {
  return { items: (await myTraining(identity.user.id)).map(trainingDto) };
}

export async function trainingItem(identity: StaffIdentity, id: string) {
  const row = (await myTraining(identity.user.id)).find((r) => r.id === id);
  if (!row) notFound();
  const course = await myCourse(identity.user.id, id);
  // A course with lessons sends its outline; one without sends its old text.
  // A final exam, if the course has one: its rules and how they have done. Never the questions.
  const exam = course ? await myExam(me(identity), id) : null;
  // A practical: what the trainer will watch for, and how the last observation went.
  const practical = row.course.requiresSignoff ? await myPractical(identity.user.id, id) : null;
  // Their rating once they have finished (phase 6).
  const feedback = row.state === "completed" || row.state === "submitted" ? await myFeedback(identity.user.id, id) : null;
  return { ...trainingDto(row), content: course ? "" : row.course.content, sections: course?.sections ?? null,
    // Courses to finish first (by name) and whether lessons go in order (phase 8).
    waitingOn: course?.waitingOn.map((c) => c.title) ?? [], inOrder: course?.inOrder ?? false, exam: exam && examDto(exam), whatsNew: course?.whatsNew ?? null, practical: practical && practicalDto(practical),
    canRate: row.state === "completed" || row.state === "submitted", feedback };
}

const practicalDto = (p: NonNullable<Awaited<ReturnType<typeof myPractical>>>) => ({
  steps: p.steps.map((s) => ({ id: s.id, text: s.text, critical: s.critical })),
  last: p.last && { observedBy: p.last.observedByName, observedAt: p.last.observedAt, steps: p.last.steps.map((s) => ({ id: s.id, text: s.text, result: s.result, note: s.note })) },
});

/** Their learning paths, sessions and in-service hours (phase 5). */
export async function trainingPlan(identity: StaffIdentity) {
  const plan = await myPlan(identity.user.id, identity.user.orgId);
  return {
    paths: plan.paths.map((p) => ({
      id: p.id, title: p.title, summary: p.summary, startsOn: date(p.startsOn), done: p.done, total: p.total, finishedOn: date(p.finishedOn), overdue: p.overdue,
      steps: p.steps.map((s) => ({ title: s.title, assignmentId: s.assignmentId, state: s.state.state === "open" ? (s.state.submitted ? "submitted" : s.state.overdue ? "overdue" : "assigned") : s.state.state === "done" ? "completed" : "cancelled",
        dueOn: s.state.state === "open" ? date(s.state.dueOn) : null, completedOn: s.state.state === "done" ? date(s.state.on) : null })),
    })),
    sessions: plan.sessions.map((s) => ({ id: s.id, title: s.title, when: s.when, startsAt: s.startsAt.toISOString(), upcoming: !s.closed && s.startsAt.getTime() > Date.now() - 12 * 3600_000, course: s.course, site: s.site, location: s.location, trainer: s.trainerName, status: s.status, closed: s.closed })),
    hours: {
      progress: plan.hours.progress.map((h) => ({ qualification: h.typeName, hours: h.hours, windowMonths: h.windowMonths, minutes: h.minutes, since: date(h.since), met: h.met, percent: h.percent })),
      log: plan.hours.log.map((l) => ({ id: l.id, on: date(l.on), minutes: l.minutes, topic: l.topic, qualification: l.typeName })),
    },
  };
}

const me = (identity: StaffIdentity) => ({ id: identity.user.id, name: identity.user.name });

/** A question as the learner sees it: never which answer is right. */
type LearnerQuestion = { id: string; kind: string; prompt: string; imageId: string | null; options: { id: string; text: string; imageId: string | null }[]; partners: { id: string; text: string }[] | null; segments: string[] | null };
const questionDto = (q: LearnerQuestion) => ({
  id: q.id, kind: q.kind, prompt: q.prompt, imageId: q.imageId,
  options: q.options.map((o) => ({ id: o.id, text: o.text, imageId: o.imageId })), partners: q.partners?.map((p) => ({ id: p.id, text: p.text })) ?? null,
  segments: q.segments ?? null,
});
const examDto = (exam: NonNullable<Awaited<ReturnType<typeof myExam>>>) => ({
  questions: exam.questions, passMark: exam.passMark, timeLimit: exam.timeLimit, testOut: exam.testOut, attempts: exam.attempts,
  passed: exam.passed, lessonsDone: exam.lessonsDone, canStart: exam.canStart, reason: exam.reason, open: exam.open, history: exam.history,
});
type Paper = NonNullable<Awaited<ReturnType<typeof myExamPaper>>>;
const paperDto = (paper: Paper) => ({
  id: paper.id, number: paper.number, deadlineAt: paper.deadlineAt, questions: paper.questions.map((q) => ({ ...questionDto(q), answer: q.answer })),
});
const answerSchema = z.union([
  z.string().max(200), z.array(z.string().max(64)).max(8), z.record(z.string().max(64), z.string().max(64)),
]).nullable();

/** One lesson of the person's own course: its text, video or file, and the
 *  lessons either side. Built field by field; never another person's. */
export async function trainingLesson(identity: StaffIdentity, id: string, lessonId: string) {
  const lesson = await myLesson(identity.user.id, id, lessonId);
  if (!lesson) notFound();
  const saved = await myLessonNote(identity.user.id, id, lessonId);
  return {
    // Their own bookmark and private note on it (phase 6).
    bookmarked: saved.bookmarked, note: saved.note,
    id: lesson.id, kind: lesson.kind, title: lesson.title, body: lesson.body, minutes: lesson.minutes, video: lesson.video,
    file: lesson.file && { id: lesson.file.id, name: lesson.file.name, mime: lesson.file.mime, size: lesson.file.size },
    section: lesson.section, index: lesson.index, total: lesson.total, prev: lesson.prev, next: lesson.next, done: lesson.done, open: lesson.open,
    questions: lesson.questions?.map(questionDto) ?? null,
    checks: lesson.checks.map(questionDto),
    // A Scenario's scenes, a Flashcards lesson's cards, a Checklist's items: practice, so sent whole.
    steps: lesson.steps?.map((st) => ({ id: st.id, text: st.text, imageId: st.imageId, choices: st.choices.map((c) => ({ id: c.id, text: c.text, feedback: c.feedback, next: c.next, best: c.best })) })) ?? null,
    cards: lesson.cards?.map((c) => ({ id: c.id, front: c.front, back: c.back, imageId: c.imageId })) ?? null,
    items: lesson.items?.map((i) => ({ id: i.id, text: i.text })) ?? null,
    // Phase 8. Sorting is practice, so where each thing belongs is sent with it.
    sorting: lesson.sorting && { groups: lesson.sorting.groups.map((g) => ({ id: g.id, name: g.name })), sorts: lesson.sorting.sorts.map((i) => ({ id: i.id, text: i.text, group: i.group })) },
    spots: lesson.spots?.map((sp) => ({ id: sp.id, x: sp.x, y: sp.y, title: sp.title, text: sp.text })) ?? null,
    embed: lesson.embed && { src: lesson.embed.src, href: lesson.embed.href, provider: lesson.embed.provider },
    handIn: lesson.handIn && {
      text: lesson.handIn.settings?.text ?? "required", photo: lesson.handIn.settings?.photo ?? "optional", review: lesson.handIn.settings?.review ?? true,
      submission: lesson.handIn.submission && {
        status: lesson.handIn.submission.status, text: lesson.handIn.submission.text, fileName: lesson.handIn.submission.fileName, feedback: lesson.handIn.submission.feedback,
        reviewedBy: lesson.handIn.submission.reviewedByName, reviewedAt: lesson.handIn.submission.reviewedAt?.toISOString() ?? null, submittedAt: lesson.handIn.submission.submittedAt.toISOString(),
      },
    },
    locked: lesson.locked,
  };
}

const handInSchema = z.object({
  text: z.string().max(MAX_HAND_IN_TEXT, "Keep your answer under 5,000 characters.").default(""),
  file: z.object({
    fileName: z.string().trim().min(1).max(120).regex(/^[^/\\\r\n]+$/, "Use a plain file name."),
    mime: z.enum(HAND_IN_TYPES as [string, ...string[]]),
    data: z.string().min(4).max(5_800_000),
  }).strict().nullable().default(null),
  keepFile: z.boolean().default(false),
  /** When it was handed in on the phone with no signal (phase 9). */
  at: z.string().max(40).nullable().default(null),
}).strict();

/** Hands in work on a Hand in work lesson: a written answer, a photo or PDF, or both. */
export async function handInTraining(request: Request, identity: StaffIdentity, id: string, lessonId: string) {
  const input = await readBody(request, handInSchema, 6_000_000);
  await rateLimit(`training-hand-in:${identity.user.id}`, 30, 3600);
  const bytes = input.file ? Buffer.from(input.file.data, "base64") : null;
  const result = await handInWork(me(identity), id, lessonId, { text: input.text, keepFile: input.keepFile, at: input.at, file: input.file && bytes ? { name: input.file.fileName, mime: input.file.mime, bytes } : null });
  if (!result.ok) {
    if (result.error.includes("not assigned to you") || result.error.includes("not in your course")) notFound();
    throw failed(result.error);
  }
  return trainingLesson(identity, id, lessonId);
}

/** The photo or PDF they handed in, to look at again. */
export async function trainingHandInFile(identity: StaffIdentity, id: string, lessonId: string) {
  const file = await mySubmissionFile(identity.user.id, id, lessonId);
  if (!file) notFound();
  return trainingFileResponse(file);
}

/** Checks one practice question on a Quiz lesson: right or not, and why. */
export async function checkTrainingQuiz(request: Request, identity: StaffIdentity, id: string, lessonId: string) {
  const input = await readBody(request, z.object({ questionId: idSchema, answer: answerSchema, giveUp: z.boolean().default(false) }).strict());
  await rateLimit(`training-check:${identity.user.id}`, 120, 60);
  const result = await checkQuizAnswer(identity.user.id, id, lessonId, input.questionId, input.answer, input.giveUp);
  if (!result) notFound();
  return result;
}

/** The final exam: its rules, past attempts, and the open paper if there is one. */
export async function trainingExam(identity: StaffIdentity, id: string) {
  const exam = await myExam(me(identity), id);
  if (!exam) notFound();
  const paper = exam.open ? await myExamPaper(me(identity), id) : null;
  return { ...examDto(exam), paper: paper && paperDto(paper) };
}

export async function startTrainingExam(identity: StaffIdentity, id: string) {
  const result = await startExam(me(identity), id);
  if (!result.ok) {
    if (result.error.includes("not assigned to you") || result.error.includes("has no exam")) notFound();
    throw failed(result.error);
  }
  return trainingExam(identity, id);
}

export async function saveTrainingExamAnswer(request: Request, identity: StaffIdentity, id: string) {
  const input = await readBody(request, z.object({ attemptId: idSchema, questionId: idSchema, answer: answerSchema }).strict());
  const result = await saveExamAnswer(me(identity), id, input.attemptId, input.questionId, input.answer);
  if (!result.ok) throw failed(result.error);
  return { saved: true };
}

export async function submitTrainingExam(request: Request, identity: StaffIdentity, id: string) {
  const { attemptId } = await readBody(request, z.object({ attemptId: idSchema }).strict());
  const result = await submitExam(me(identity), id, attemptId);
  if (!result.ok) {
    if (result.error.includes("not yours")) notFound();
    throw failed(result.error);
  }
  const exam = await myExam(me(identity), id);
  const last = exam?.history.at(-1);
  return { number: last?.number ?? null };
}

/** One handed-in attempt: the score, and after a pass every question with the right answer and why. */
export async function trainingExamResult(identity: StaffIdentity, id: string, number: number) {
  const result = await myExamResult(identity.user.id, id, number);
  if (!result) notFound();
  return {
    number: result.number, submittedAt: result.submittedAt, correct: result.correct, total: result.total, percent: result.percent, passed: result.passed, passMark: result.passMark,
    revisit: result.revisit.map((s) => ({ id: s.id, title: s.title, firstLessonId: s.firstLessonId })),
    review: result.review?.map((q) => ({ ...questionDto(q), yours: q.yours, right: q.right, correct: q.correct, explanation: q.explanation })) ?? null,
  };
}

/** Finishing a lesson. Turnfin Me sends `{ at }` when it was finished with no signal (phase 9); no body is now. */
const completeLessonSchema = z.object({ at: z.string().max(40).nullable().default(null) }).strict();
export async function completeTrainingLesson(request: Request, identity: StaffIdentity, id: string, lessonId: string) {
  const input = request.headers.get("content-type")?.toLowerCase().startsWith("application/json") ? await readBody(request, completeLessonSchema) : { at: null };
  const result = await completeLessonFor({ id: identity.user.id, name: identity.user.name }, id, lessonId, input.at);
  if (!result.ok) {
    if (result.error.includes("not assigned to you") || result.error.includes("not in your course")) notFound();
    throw failed(result.error);
  }
  return trainingLesson(identity, id, lessonId);
}

/** A PDF or image from the person's own course version, sent as the file itself. */
/** A finished course's certificate, with the code a trainer checks it by. */
export async function trainingCertificate(identity: StaffIdentity, id: string) {
  const certificate = await myCertificate(me(identity), id);
  if (!certificate) notFound();
  return certificate;
}

export async function trainingFile(identity: StaffIdentity, id: string, fileId: string) {
  const file = await myCourseFile(identity.user.id, id, fileId);
  if (!file) notFound();
  return trainingFileResponse(file);
}

export async function completeTraining(request: Request, identity: StaffIdentity, id: string) {
  const { note } = await readBody(request, z.object({ note: text(1000).default("") }).strict());
  const result = await completeTrainingFor({ id: identity.user.id, name: identity.user.name }, id, note);
  if (!result.ok) {
    if (result.error.includes("not assigned to you")) notFound();
    throw failed(result.error);
  }
  return trainingItem(identity, id);
}

// ---------------------------------------------------------------------------
// The learner's own space (phase 6): search, saved lessons, record, catalogue, refreshers
// ---------------------------------------------------------------------------

/** Their courses and lessons with every word searched for. */
export async function trainingSearch(request: Request, identity: StaffIdentity) {
  const q = parseInput(z.string().trim().min(2, "Type at least two letters.").max(80), new URL(request.url).searchParams.get("q") ?? "");
  await rateLimit(`training-search:${identity.user.id}`, 60, 60);
  const found = await searchMyTraining(identity.user.id, q);
  return {
    courses: found.courses.map((c) => ({ assignmentId: c.assignmentId, title: c.title, snippet: c.snippet })),
    lessons: found.lessons.map((l) => ({ assignmentId: l.assignmentId, lessonId: l.lessonId, course: l.course, section: l.section, title: l.title, snippet: l.snippet })),
  };
}

/** A bookmark or private note on a lesson of their own course. */
export async function saveTrainingNote(request: Request, identity: StaffIdentity, id: string, lessonId: string) {
  const input = await readBody(request, z.object({ bookmarked: z.boolean().optional(), note: z.string().max(2000).optional() }).strict());
  await rateLimit(`training-note:${identity.user.id}`, 120, 60);
  const result = await saveLessonNote(me(identity), id, lessonId, input);
  if (!result.ok) notFound();
  return myLessonNote(identity.user.id, id, lessonId);
}

export async function trainingSaved(identity: StaffIdentity) {
  return { items: (await mySaved(identity.user.id)).map((n) => ({ assignmentId: n.assignmentId, lessonId: n.lessonId, course: n.course, section: n.section, title: n.title, bookmarked: n.bookmarked, note: n.note, updatedAt: n.updatedAt.toISOString() })) };
}

/** Everything on their training record, to read, print or download. */
export async function trainingRecord(identity: StaffIdentity) {
  const record = await myRecord(identity.user.id, identity.user.orgId);
  return {
    name: identity.user.name,
    courses: record.courses.map((c) => ({ id: c.id, title: c.title, category: c.category, state: c.state, assignedAt: c.assignedAt.toISOString(), assignedBy: c.assignedBy, dueOn: date(c.dueOn),
      completedAt: c.completedAt?.toISOString() ?? null, signedOffBy: c.signedOffBy, grants: c.grants, version: c.version, exam: c.exam, certificate: c.certificate })),
    sessions: record.sessions.map((s) => ({ title: s.title, when: s.when, course: s.course, trainer: s.trainerName })),
    paths: record.paths.map((p) => ({ title: p.title, startsOn: date(p.startsOn), done: p.done, total: p.total, finishedOn: date(p.finishedOn) })),
    hours: {
      progress: record.hours.progress.map((h) => ({ qualification: h.typeName, hours: h.hours, windowMonths: h.windowMonths, minutes: h.minutes, since: date(h.since), met: h.met })),
      log: record.hours.log.map((l) => ({ on: date(l.on), minutes: l.minutes, topic: l.topic, qualification: l.typeName })),
    },
  };
}

/** Courses open to everyone, to enrol on themselves. */
export async function trainingCatalogue(identity: StaffIdentity) {
  return { items: (await catalogueFor(identity.user.id, identity.user.orgId)).map((c) => ({
    id: c.id, title: c.title, summary: c.summary, category: c.category, tags: c.tags, hasCover: !!c.coverId, requiresSignoff: c.requiresSignoff, grants: c.grants,
    lessons: c.lessons, minutes: c.minutes, exam: c.exam, rating: c.rating, mine: c.mine,
  })) };
}

export async function trainingCatalogueCover(identity: StaffIdentity, courseId: string) {
  const file = await catalogueCover(identity.user.orgId, courseId);
  if (!file) notFound();
  return trainingFileResponse(file);
}

export async function enrolOnCourse(identity: StaffIdentity, courseId: string) {
  await rateLimit(`training-enrol:${identity.user.id}`, 20, 3600);
  const result = await enrolMyself({ id: identity.user.id, name: identity.user.name, orgId: identity.user.orgId }, courseId);
  if (!result.ok) notFound();
  return { assignmentId: result.assignmentId, already: result.already };
}

/** Their rating of a course they finished, and what was unclear. */
export async function rateTraining(request: Request, identity: StaffIdentity, id: string) {
  const input = await readBody(request, z.object({ rating: z.number().int().min(1).max(5), unclear: text(1000).default("") }).strict());
  const result = await rateCourse(me(identity), id, input);
  if (!result.ok) {
    if (result.error.includes("not assigned to you")) notFound();
    throw failed(result.error);
  }
  return myFeedback(identity.user.id, id);
}

/** Today's refresher questions, their streak and badges. */
export async function trainingRefresher(identity: StaffIdentity) {
  const r = await myRefresher(identity.user.id, identity.user.orgId);
  return {
    on: r.on, goal: r.goal, answered: r.answered, correct: r.correct, streak: r.streak,
    questions: r.questions.map((q) => ({ cardId: q.cardId, assignmentId: q.assignmentId, course: q.course, question: questionDto(q.question) })),
    badges: r.badges.map((b) => ({ id: b.id, title: b.title, hint: b.hint, earned: b.earned })),
  };
}

export async function answerTrainingRefresher(request: Request, identity: StaffIdentity) {
  const input = await readBody(request, z.object({ cardId: idSchema.optional(), assignmentId: idSchema.optional(), questionId: idSchema.optional(), answer: answerSchema }).strict());
  await rateLimit(`training-refresher:${identity.user.id}`, 60, 60);
  const result = await answerRefresher(identity.user.id, input, input.answer);
  if (!result) notFound();
  return result.done ? { done: true, correct: null, explanation: "", nextIn: null } : { done: false, correct: result.correct, explanation: result.explanation, nextIn: result.nextIn };
}

// ---------------------------------------------------------------------------
// Required reading (Docs database)
// ---------------------------------------------------------------------------

async function myRequirements(identity: StaffIdentity) {
  const d = await docsReading();
  if (!d) return [];
  try {
    return (await d.requirements(identity.user.id)).filter((r) => r.status !== "cancelled");
  } catch {
    // Someone without Docs access has no required reading.
    return [];
  }
}

export async function reading(identity: StaffIdentity) {
  const on = today();
  return { items: (await myRequirements(identity)).map((r) => ({
    documentId: r.documentId, versionId: r.versionId, title: r.title, reference: r.reference, version: r.version,
    dueOn: r.dueDate ? r.dueDate.slice(0, 10) : null, status: r.status, acknowledgedAt: r.acknowledgedAt,
    overdue: r.status === "outstanding" && !!r.dueDate && r.dueDate.slice(0, 10) < on,
  })) };
}

/** Only documents assigned to the person as required reading open here. */
export async function readingItem(identity: StaffIdentity, documentId: string) {
  const requirement = (await myRequirements(identity)).find((r) => r.documentId === documentId);
  const d = await docsReading();
  if (!requirement || !d) notFound();
  const view = await d.documentView(identity.user.id, documentId, requirement.versionId);
  const content = view.selected?.content;
  if (!content) notFound();
  return {
    documentId, versionId: requirement.versionId, version: requirement.version, title: content.title, reference: content.reference,
    summary: content.summary, body: content.body, dueOn: requirement.dueDate ? requirement.dueDate.slice(0, 10) : null,
    status: requirement.status, acknowledgedAt: view.acknowledgedAt,
    current: view.document.currentVersionId === requirement.versionId,
  };
}

export async function acknowledgeReading(request: Request, identity: StaffIdentity, documentId: string) {
  const { versionId } = await readBody(request, z.object({ versionId: idSchema }).strict());
  const requirement = (await myRequirements(identity)).find((r) => r.documentId === documentId && r.versionId === versionId);
  const d = await docsReading();
  if (!requirement || !d) notFound();
  try {
    await d.acknowledge(identity.user.id, documentId, versionId);
  } catch (error) {
    throw failed(error instanceof Error ? error.message : "That could not be recorded. Try again.");
  }
  return readingItem(identity, documentId);
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

export async function shifts(request: Request, identity: StaffIdentity) {
  const days = parseInput(z.coerce.number().int().min(1).max(56), new URL(request.url).searchParams.get("days") ?? 28);
  // Each day at each site: the activities, the breaks placed for them, and the shift from them.
  return { items: (await myDays(identity.user.id, days)).map((d) => ({
    id: `${d.date}|${d.siteId}`, date: d.date, site: d.site, changed: d.changed,
    startMinutes: d.shift.start, endMinutes: d.shift.end, paidMinutes: d.shift.paidMinutes,
    // Breaks they are owed that found no free time: to arrange with the duty manager on the day.
    breaksToArrange: d.shift.parts.reduce((n, p) => n + p.unplaced.reduce((m, b) => m + b.minutes, 0), 0),
    blocks: [
      ...d.items.map((i) => ({ kind: "activity" as const, startMinutes: i.start, endMinutes: i.end, label: i.label, icon: i.icon, place: i.place, needs: i.needs, warning: i.problem })),
      ...d.shift.parts.flatMap((p) => p.breaks.map((b) => ({ kind: "break" as const, startMinutes: b.start, endMinutes: b.end, label: b.paid ? "Paid break" : "Unpaid break", icon: "break", place: "", needs: null, warning: null }))),
    ].sort((a, b) => a.startMinutes - b.startMinutes),
  })) };
}

// ---------------------------------------------------------------------------
// HR: what has been shared with the person (needs a fresh code)
// ---------------------------------------------------------------------------

export async function hr(identity: StaffIdentity) {
  requireConfirmed(identity);
  if (!hrConfigured()) return { configured: false, notes: [], reviews: [] };
  const { notes, reviews } = await mySharedHr(identity.user.id, identity.user.orgId);
  await logOwnHrRead({ id: identity.user.id, name: identity.user.name, orgId: identity.user.orgId });
  return {
    configured: true,
    notes: notes.map((n) => ({ id: n.id, author: n.authorName, body: n.body, createdAt: new Date(n.createdAt).toISOString() })),
    reviews: reviews.map((r) => ({
      id: r.id, period: r.period, reviewer: r.reviewerName, status: r.status, summary: r.summary, strengths: r.strengths, goals: r.goals,
      overall: r.overall, comment: r.subjectComment, sharedAt: r.sharedAt ? new Date(r.sharedAt).toISOString() : null,
      acknowledgedAt: r.acknowledgedAt ? new Date(r.acknowledgedAt).toISOString() : null,
    })),
  };
}

export async function acknowledgeReview(request: Request, identity: StaffIdentity, id: string) {
  requireConfirmed(identity);
  const { comment } = await readBody(request, z.object({ comment: text(2000).default("") }).strict());
  if (!hrConfigured()) notFound();
  const result = await acknowledgeReviewFor({ id: identity.user.id, name: identity.user.name, orgId: identity.user.orgId }, id, comment);
  if (!result.ok) notFound();
  return hr(identity);
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

const PREFS = ["trainingDue", "qualificationExpiry", "readingOverdue", "shiftChanges"] as const;

export async function notifications(identity: StaffIdentity) {
  const row = await prisma.staffNotificationPreference.findUnique({ where: { userId: identity.user.id } });
  return Object.fromEntries(PREFS.map((key) => [key, row ? row[key] : true]));
}

export async function saveNotifications(request: Request, identity: StaffIdentity) {
  const input = await readBody(request, z.object(Object.fromEntries(PREFS.map((k) => [k, z.boolean()])) as Record<(typeof PREFS)[number], z.ZodBoolean>).strict());
  await prisma.staffNotificationPreference.upsert({ where: { userId: identity.user.id }, update: input, create: { userId: identity.user.id, ...input } });
  return notifications(identity);
}

// ---------------------------------------------------------------------------
// Home: what needs the person, without any HR content
// ---------------------------------------------------------------------------

export async function home(identity: StaffIdentity) {
  const [train, read, quals, upcoming, reviewsWaiting, refresher] = await Promise.all([
    training(identity),
    reading(identity),
    myQualifications(identity.user.id),
    myDays(identity.user.id, 7),
    hrConfigured()
      ? mySharedHr(identity.user.id, identity.user.orgId).then((r) => r.reviews.filter((x) => x.status === "shared").length).catch(() => 0)
      : Promise.resolve(0),
    refresherWaiting(identity.user.id).catch(() => 0),
  ]);
  return {
    name: identity.user.name,
    // Questions in today's refresher still to answer (phase 6).
    refresher,
    training: train.items.filter((t) => t.state === "assigned" || t.state === "overdue" || t.state === "submitted"),
    reading: read.items.filter((r) => r.status === "outstanding"),
    qualifications: quals.filter((q) => q.state === "expiring" || q.state === "expired").map((q) => ({ id: q.id, name: q.type.name, expiresOn: date(q.expiresOn), state: q.state })),
    // Each day's shift, worked out from the activities on it.
    shifts: upcoming.slice(0, 3).map((d) => ({ id: `${d.date}|${d.siteId}`, date: d.date, startMinutes: d.shift.start, endMinutes: d.shift.end,
      role: [...new Set(d.items.map((i) => i.label.split(":")[0]))].join(", "), site: d.site, warnings: [...new Set(d.items.flatMap((i) => (i.problem ? [i.problem] : [])))] })),
    // A count only: HR content needs a fresh code.
    reviewsToAcknowledge: reviewsWaiting,
  };
}
