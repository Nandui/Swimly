"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { activeStaffAmong } from "@/lib/directory";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { filterAllows } from "@/lib/policy/engine";
import { subjectsFor } from "@/lib/policy/session";
import { requireTrainingActor, type TrainingActor } from "@/modules/training/shared/access";
import { cleanDoc, cleanLessonData, docActivities, docBlocks, EMBED_SOURCES, embedFor, isLessonKind, LESSON_KIND_META, lessonFiles, MAX_LESSONS, MAX_SECTIONS, frozenOutline, plainTextDoc, publishProblems, startingLessonData, videoFor, type LessonKind } from "@/modules/training/shared/lessons";
import { refresh } from "@/modules/training/shared/writes";
import { MAX_QUESTIONS, QUESTION_KINDS, normaliseQuestion, questionFiles, questionProblem, QUESTION_KIND_META, readExam, type ExamSettings, type QuestionOption } from "@/modules/training/shared/questions";
import { loadDraft } from "@/modules/training/features/builder/server/draft";
import { cleanObservation, MAX_OBSERVATION_STEPS } from "@/modules/training/shared/on-the-job";

/** The course builder (e-learning phase 1). Building needs
 *  `training.manage` (the Author level and above). The draft is only ever seen
 *  in the builder and its preview; Publish freezes it into a numbered version,
 *  which is what learners get. Every change is audited in its transaction. */

type Created = { ok: true; id: string } | Extract<ActionResult, { ok: false }>;
const NO_RIGHT = "Building courses needs the Author level in Training.";

async function author() {
  const who = await requireTrainingActor();
  return who.manage && who.orgId ? who as TrainingActor & { orgId: string } : null;
}

/** The course, if it belongs to the author's organisation and can still change. */
async function courseFor(tx: Prisma.TransactionClient, who: { orgId: string }, courseId: string) {
  return tx.trainingCourse.findFirst({ where: { id: courseId, orgId: who.orgId }, select: { id: true, title: true, archivedAt: true, content: true } });
}

async function sectionFor(tx: Prisma.TransactionClient, who: { orgId: string }, sectionId: string) {
  return tx.trainingSection.findFirst({ where: { id: sectionId, course: { orgId: who.orgId } }, select: { id: true, title: true, courseId: true, position: true, course: { select: { title: true } } } });
}

async function lessonFor(tx: Prisma.TransactionClient, who: { orgId: string }, lessonId: string) {
  return tx.trainingLesson.findFirst({ where: { id: lessonId, section: { course: { orgId: who.orgId } } }, select: {
    id: true, title: true, kind: true, position: true, sectionId: true, section: { select: { courseId: true, position: true, course: { select: { title: true } } } },
  } });
}

const audit = (who: TrainingActor, tx: Prisma.TransactionClient, action: string, courseId: string, summary: string) =>
  logAudit({ actorId: who.id, actorName: who.name, action, entity: "TrainingCourse", entityId: courseId, summary }, tx);

const done = (courseId: string) => refresh("/training/courses", `/training/courses/${courseId}`);

const titleSchema = z.string().trim().min(2, "Give it a name.").max(120, "Keep the name under 120 characters.");

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export async function addSection(courseId: string, title: string): Promise<Created> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  const name = titleSchema.safeParse(title);
  if (!name.success) return fail(name.error.issues[0].message);
  const result = await prisma.$transaction(async (tx): Promise<Created> => {
    const course = await courseFor(tx, who, courseId);
    if (!course) return fail("That course no longer exists.");
    const count = await tx.trainingSection.count({ where: { courseId } });
    if (count >= MAX_SECTIONS) return fail(`A course can have up to ${MAX_SECTIONS} sections.`);
    const last = await tx.trainingSection.findFirst({ where: { courseId }, orderBy: { position: "desc" }, select: { position: true } });
    const row = await tx.trainingSection.create({ data: { courseId, title: name.data, position: (last?.position ?? 0) + 1 } });
    await audit(who, tx, "update", courseId, `Added the section ${name.data} to ${course.title}`);
    return { ok: true, id: row.id };
  });
  if (result.ok) done(courseId);
  return result;
}

export async function renameSection(sectionId: string, title: string): Promise<ActionResult> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  const name = titleSchema.safeParse(title);
  if (!name.success) return fail(name.error.issues[0].message);
  let courseId = "";
  const result = await prisma.$transaction(async (tx) => {
    const section = await sectionFor(tx, who, sectionId);
    if (!section) return fail("That section no longer exists.");
    courseId = section.courseId;
    if (section.title === name.data) return ok();
    await tx.trainingSection.update({ where: { id: sectionId }, data: { title: name.data } });
    await audit(who, tx, "update", section.courseId, `Renamed the section ${section.title} to ${name.data} in ${section.course.title}`);
    return ok();
  });
  if (result.ok) done(courseId);
  return result;
}

/** Removes a section from the draft, with its lessons. Published versions keep theirs. */
export async function removeSection(sectionId: string): Promise<ActionResult> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  let courseId = "";
  const result = await prisma.$transaction(async (tx) => {
    const section = await sectionFor(tx, who, sectionId);
    if (!section) return ok();
    courseId = section.courseId;
    await tx.trainingLesson.deleteMany({ where: { sectionId } });
    await tx.trainingSection.delete({ where: { id: sectionId } });
    await audit(who, tx, "update", section.courseId, `Removed the section ${section.title} from the draft of ${section.course.title}`);
    return ok();
  });
  if (result.ok && courseId) done(courseId);
  return result;
}

export async function moveSection(sectionId: string, direction: "up" | "down"): Promise<ActionResult> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  let courseId = "";
  const result = await prisma.$transaction(async (tx) => {
    const section = await sectionFor(tx, who, sectionId);
    if (!section) return fail("That section no longer exists.");
    courseId = section.courseId;
    const neighbour = await tx.trainingSection.findFirst({
      where: { courseId: section.courseId, position: direction === "up" ? { lt: section.position } : { gt: section.position } },
      orderBy: { position: direction === "up" ? "desc" : "asc" }, select: { id: true, position: true },
    });
    if (!neighbour) return ok();
    await tx.trainingSection.update({ where: { id: section.id }, data: { position: neighbour.position } });
    await tx.trainingSection.update({ where: { id: neighbour.id }, data: { position: section.position } });
    await audit(who, tx, "update", section.courseId, `Moved the section ${section.title} ${direction} in ${section.course.title}`);
    return ok();
  });
  if (result.ok) done(courseId);
  return result;
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export async function addLesson(sectionId: string, kind: LessonKind, title: string): Promise<Created> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  if (!(kind in LESSON_KIND_META)) return fail("Choose what kind of lesson it is.");
  const name = titleSchema.safeParse(title);
  if (!name.success) return fail(name.error.issues[0].message);
  let courseId = "";
  const result = await prisma.$transaction(async (tx): Promise<Created> => {
    const section = await sectionFor(tx, who, sectionId);
    if (!section) return fail("That section no longer exists.");
    courseId = section.courseId;
    if (await tx.trainingLesson.count({ where: { section: { courseId } } }) >= MAX_LESSONS) return fail(`A course can have up to ${MAX_LESSONS} lessons.`);
    const last = await tx.trainingLesson.findFirst({ where: { sectionId }, orderBy: { position: "desc" }, select: { position: true } });
    const start = startingLessonData(kind);
    const row = await tx.trainingLesson.create({ data: { sectionId, kind, title: name.data, position: (last?.position ?? 0) + 1, data: start ? (start as unknown as Prisma.InputJsonValue) : Prisma.DbNull } });
    await audit(who, tx, "update", courseId, `Added the ${LESSON_KIND_META[kind].label.toLowerCase()} lesson ${name.data} to ${section.course.title}`);
    return { ok: true, id: row.id };
  });
  if (result.ok) done(courseId);
  return result;
}

const lessonSchema = z.object({
  title: titleSchema,
  /** The Tiptap document as JSON text: a client object can't be read on the server directly. */
  body: z.string().max(400_000, "This lesson is too long. Split it into two.").nullable(),
  videoUrl: z.string().trim().max(500, "Keep the link under 500 characters."),
  fileId: z.string().trim().max(64).transform((v) => v || null),
  minutes: z.number().int().min(1, "Minutes start at 1.").max(240, "Keep a lesson under 4 hours.").nullable(),
  /** A Scenario, Flashcards or Checklist lesson's own settings, as JSON text. */
  data: z.string().max(200_000, "This lesson is too long. Split it into two.").nullable().default(null),
  /** Saved as a page: everything is in the text, put there with Add (D18). An
   *  older lesson becomes a page the first time it is saved from the builder. */
  page: z.boolean().default(false),
});
export type LessonInput = z.input<typeof lessonSchema>;

export async function saveLesson(lessonId: string, input: LessonInput): Promise<ActionResult> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  const parsed = lessonSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { title, videoUrl, fileId, minutes } = parsed.data;
  let raw: unknown = null, rawData: unknown = null;
  try {
    raw = parsed.data.body ? JSON.parse(parsed.data.body) : null;
    rawData = parsed.data.data ? JSON.parse(parsed.data.data) : null;
  } catch { return fail("The lesson could not be read. Reload and try again."); }
  const body = cleanDoc(raw);
  let courseId = "";
  const result = await prisma.$transaction(async (tx) => {
    const lesson = await lessonFor(tx, who, lessonId);
    if (!lesson) return fail("That lesson no longer exists.");
    courseId = lesson.section.courseId;
    if (lesson.kind === "VIDEO" && videoUrl && !videoFor(videoUrl)) return fail("Use a video link that starts https://.");
    if (lesson.kind === "EMBED" && videoUrl && !embedFor(videoUrl)) return fail(`Use a link from ${EMBED_SOURCES}.`);
    const kind = parsed.data.page ? "READING" : isLessonKind(lesson.kind) ? lesson.kind : "READING";
    const data = cleanLessonData(kind, rawData, undefined, true);
    const ownFile = kind === "FILE" || kind === "AUDIO" || kind === "EXPLORE" ? fileId : null;
    const files = lessonFiles({ fileId: ownFile, body, data });
    if (files.length) {
      const found = await tx.trainingFile.count({ where: { id: { in: [...new Set(files)] }, courseId } });
      if (found !== new Set(files).size) return fail("A file in this lesson is no longer available. Add it again.");
    }
    if (kind === "AUDIO" && ownFile && !(await tx.trainingFile.findFirst({ where: { id: ownFile, courseId, mime: { startsWith: "audio/" } }, select: { id: true } }))) {
      return fail("Choose a recording (MP3, M4A, OGG or WAV) for an Audio lesson.");
    }
    if (kind === "EXPLORE" && ownFile && !(await tx.trainingFile.findFirst({ where: { id: ownFile, courseId, mime: { startsWith: "image/" } }, select: { id: true } }))) {
      return fail("Choose a picture (JPEG, PNG or WebP) to explore.");
    }
    // Recordings and pictures to explore placed with Add must be the right kind of file too.
    const recordings = docBlocks(body).filter((n) => n.type === "audioBlock").map((n) => String(n.attrs?.fileId));
    const pictures = docActivities(body).filter((b) => b.kind === "EXPLORE" && b.fileId).map((b) => b.fileId!);
    if (recordings.length && await tx.trainingFile.count({ where: { id: { in: [...new Set(recordings)] }, courseId, mime: { startsWith: "audio/" } } }) !== new Set(recordings).size) {
      return fail("Choose a recording (MP3, M4A, OGG or WAV) for each Audio block.");
    }
    if (pictures.length && await tx.trainingFile.count({ where: { id: { in: [...new Set(pictures)] }, courseId, mime: { startsWith: "image/" } } }) !== new Set(pictures).size) {
      return fail("Choose a picture (JPEG, PNG or WebP) for each Explore a picture.");
    }
    await tx.trainingLesson.update({ where: { id: lessonId }, data: {
      kind, title, body: body ? (body as Prisma.InputJsonValue) : Prisma.DbNull,
      videoUrl: kind === "VIDEO" || kind === "EMBED" ? videoUrl : "", fileId: ownFile, minutes, data: data ? (data as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
    } });
    await audit(who, tx, "update", courseId, `Saved the lesson ${title} in ${lesson.section.course.title}`);
    return ok();
  });
  if (result.ok) done(courseId);
  return result;
}

export async function removeLesson(lessonId: string): Promise<ActionResult> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  let courseId = "";
  const result = await prisma.$transaction(async (tx) => {
    const lesson = await lessonFor(tx, who, lessonId);
    if (!lesson) return ok();
    courseId = lesson.section.courseId;
    await tx.trainingLesson.delete({ where: { id: lessonId } });
    await audit(who, tx, "update", courseId, `Removed the lesson ${lesson.title} from the draft of ${lesson.section.course.title}`);
    return ok();
  });
  if (result.ok && courseId) done(courseId);
  return result;
}

/** Up or down one place. Past the top or bottom of its section, a lesson moves
 *  to the end of the section before or the start of the one after. */
export async function moveLesson(lessonId: string, direction: "up" | "down"): Promise<ActionResult> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  let courseId = "";
  const result = await prisma.$transaction(async (tx) => {
    const lesson = await lessonFor(tx, who, lessonId);
    if (!lesson) return fail("That lesson no longer exists.");
    courseId = lesson.section.courseId;
    const up = direction === "up";
    const neighbour = await tx.trainingLesson.findFirst({
      where: { sectionId: lesson.sectionId, position: up ? { lt: lesson.position } : { gt: lesson.position } },
      orderBy: { position: up ? "desc" : "asc" }, select: { id: true, position: true },
    });
    if (neighbour) {
      await tx.trainingLesson.update({ where: { id: lesson.id }, data: { position: neighbour.position } });
      await tx.trainingLesson.update({ where: { id: neighbour.id }, data: { position: lesson.position } });
    } else {
      const next = await tx.trainingSection.findFirst({
        where: { courseId, position: up ? { lt: lesson.section.position } : { gt: lesson.section.position } },
        orderBy: { position: up ? "desc" : "asc" }, select: { id: true },
      });
      if (!next) return ok();
      const edge = await tx.trainingLesson.findFirst({ where: { sectionId: next.id }, orderBy: { position: up ? "desc" : "asc" }, select: { position: true } });
      await tx.trainingLesson.update({ where: { id: lesson.id }, data: { sectionId: next.id, position: up ? (edge?.position ?? 0) + 1 : (edge?.position ?? 1) - 1 } });
    }
    await audit(who, tx, "update", courseId, `Moved the lesson ${lesson.title} ${direction} in ${lesson.section.course.title}`);
    return ok();
  });
  if (result.ok) done(courseId);
  return result;
}

// ---------------------------------------------------------------------------
// Starting from the old text, and publishing
// ---------------------------------------------------------------------------

/** A course from before lessons: its plain-text material becomes the first lesson. */
export async function startFromOldText(courseId: string): Promise<Created> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  const result = await prisma.$transaction(async (tx): Promise<Created> => {
    const course = await courseFor(tx, who, courseId);
    if (!course) return fail("That course no longer exists.");
    if (await tx.trainingSection.count({ where: { courseId } })) return fail("This course already has lessons.");
    const body = plainTextDoc(course.content);
    if (!body) return fail("This course has no text to start from.");
    const section = await tx.trainingSection.create({ data: { courseId, title: "Course", position: 1 } });
    const lesson = await tx.trainingLesson.create({ data: { sectionId: section.id, kind: "READING", title: course.title.slice(0, 120), body: body as Prisma.InputJsonValue, position: 1 } });
    await audit(who, tx, "update", courseId, `Turned the text of ${course.title} into its first lesson`);
    return { ok: true, id: lesson.id };
  });
  if (result.ok) done(courseId);
  return result;
}

const publishSchema = z.object({
  changeNote: z.string().trim().max(1000, "Keep the note under 1,000 characters.").default(""),
  retake: z.boolean().default(false),
  dueOn: z.string().trim().default(""),
});
export type PublishInput = z.input<typeof publishSchema>;

/** Freezes the draft as the next version. New assignments get it, and so does
 *  anyone who has not started; people part-way through keep their version.
 *  With a retake, people who finished an older version (and the assigner
 *  covers) are given the course again. Returns how many were. */
export async function publishCourse(courseId: string, input: PublishInput = {}): Promise<{ ok: true; retakes: number } | Extract<ActionResult, { ok: false }>> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { changeNote, retake, dueOn } = parsed.data;
  if (retake && !who.assign) return fail("Asking people to take it again needs the Manage level in Training, because it assigns the course.");
  if (dueOn && (!isDateOnly(dueOn) || dueOn < today())) return fail("Choose a due date from today onwards.");
  const scope = retake ? await subjectsFor("training.assign") : null;
  let retakes = 0;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "TrainingCourse" WHERE id = ${courseId} FOR UPDATE`;
    const course = await courseFor(tx, who, courseId);
    if (!course) return fail("That course no longer exists.");
    if (course.archivedAt) return fail("Restore this course before publishing it.");
    const draft = await loadDraft(tx, courseId);
    if (!draft) return fail("That course no longer exists.");
    const outline = frozenOutline(draft);
    const problems = publishProblems(outline);
    if (problems.length) return fail(problems.length === 1 ? problems[0] : `${problems[0]} (and ${problems.length - 1} more to fix)`);
    const last = await tx.trainingCourseVersion.findFirst({ where: { courseId }, orderBy: { number: "desc" }, select: { number: true } });
    const number = (last?.number ?? 0) + 1;
    const lessonCount = outline.sections.reduce((n, s) => n + s.lessons.length, 0);
    // Every file a question shows must still be this course's.
    const files = [...new Set(outline.questions.flatMap(questionFiles))];
    if (files.length && await tx.trainingFile.count({ where: { id: { in: files }, courseId } }) !== files.length) return fail("A picture in a question is no longer available. Add it again.");
    const version = await tx.trainingCourseVersion.create({ data: {
      courseId, number, outline: outline as unknown as Prisma.InputJsonValue, lessonCount, publishedById: who.id, publishedByName: who.name, changeNote, retake: retake && number > 1,
    } });
    await tx.trainingCourse.update({ where: { id: courseId }, data: { publishedVersionId: version.id } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "publish", entity: "TrainingCourse", entityId: courseId, summary: `Published version ${number} of ${course.title} (${lessonCount} lessons${outline.questions.length ? `, ${outline.questions.length} questions` : ""}${outline.exam ? ", with a final exam" : ""})${changeNote ? `: ${changeNote.slice(0, 200)}` : ""}` }, tx);
    if (retake && number > 1 && scope) {
      // Everyone whose latest finished training on this course was an older
      // version, who has nothing open on it, is still active and is covered.
      const finished = await tx.trainingAssignment.findMany({ where: { courseId, status: "COMPLETED" }, orderBy: { completedAt: "desc" }, select: { userId: true } });
      const open = new Set((await tx.trainingAssignment.findMany({ where: { courseId, status: { in: ["ASSIGNED", "SUBMITTED"] } }, select: { userId: true } })).map((a) => a.userId));
      const ids = [...new Set(finished.map((a) => a.userId))].filter((id) => !open.has(id) && filterAllows(scope, id));
      const learners = ids.length ? await activeStaffAmong(who.orgId, ids, tx) : [];
      for (const learner of learners) {
        const row = await tx.trainingAssignment.create({ data: {
          orgId: who.orgId, courseId, userId: learner.id, dueOn: dueOn ? parseDateOnly(dueOn) : null, assignedById: who.id, assignedByName: who.name, versionId: version.id,
        } });
        await logAudit({ actorId: who.id, actorName: who.name, action: "assign", entity: "TrainingAssignment", entityId: row.id, summary: `Assigned version ${number} of ${course.title} to ${learner.name} to take again${dueOn ? `, due ${dueOn}` : ""}` }, tx);
      }
      retakes = learners.length;
    }
    return ok();
  });
  if (!result.ok) return result;
  done(courseId);
  return { ok: true, retakes };
}

// ---------------------------------------------------------------------------
// Questions (phase 2): each section's own, for its quiz and the final exam
// ---------------------------------------------------------------------------

const questionSchema = z.object({
  kind: z.enum(QUESTION_KINDS, { message: "Choose what kind of question it is." }),
  prompt: z.string().max(1000, "Keep the question under 1,000 characters."),
  imageId: z.string().max(64).nullable(),
  options: z.array(z.object({
    id: z.string().max(32).optional(), text: z.string().max(300, "Keep each option under 300 characters."), imageId: z.string().max(64).nullable(),
    correct: z.boolean(), match: z.string().max(300, "Keep each partner under 300 characters."),
    area: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).nullable().default(null),
    unit: z.string().max(20, "Keep the unit short, such as mg/l.").optional(),
  })).max(8, "A question can have up to 8 options."),
  explanation: z.string().max(1000, "Keep the explanation under 1,000 characters."),
});
export type QuestionInput = z.input<typeof questionSchema>;

const newOptionId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10);

async function questionFor(tx: Prisma.TransactionClient, who: { orgId: string }, questionId: string) {
  return tx.trainingQuestion.findFirst({ where: { id: questionId, course: { orgId: who.orgId } }, select: {
    id: true, prompt: true, position: true, sectionId: true, courseId: true, course: { select: { title: true } },
  } });
}

/** The question as it will be stored, or what is wrong with it. Pictures must be this course's files. */
async function readyQuestion(tx: Prisma.TransactionClient, courseId: string, sectionId: string, input: QuestionInput) {
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const question = normaliseQuestion({ id: "new", sectionId, ...parsed.data }, newOptionId);
  if (!question) return { error: "Choose what kind of question it is." } as const;
  const problem = questionProblem(question);
  if (problem) return { error: problem } as const;
  const files = [...new Set(questionFiles(question))];
  if (files.length && await tx.trainingFile.count({ where: { id: { in: files }, courseId } }) !== files.length) return { error: "A picture in this question is no longer available. Add it again." } as const;
  return { question } as const;
}

const optionsJson = (options: QuestionOption[]) => options as unknown as Prisma.InputJsonValue;

export async function addQuestion(sectionId: string, input: QuestionInput): Promise<Created> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  let courseId = "";
  const result = await prisma.$transaction(async (tx): Promise<Created> => {
    const section = await sectionFor(tx, who, sectionId);
    if (!section) return fail("That section no longer exists.");
    courseId = section.courseId;
    if (await tx.trainingQuestion.count({ where: { courseId } }) >= MAX_QUESTIONS) return fail(`A course can have up to ${MAX_QUESTIONS} questions.`);
    const ready = await readyQuestion(tx, courseId, sectionId, input);
    if ("error" in ready) return fail(ready.error!);
    const { question } = ready;
    const last = await tx.trainingQuestion.findFirst({ where: { sectionId }, orderBy: { position: "desc" }, select: { position: true } });
    const row = await tx.trainingQuestion.create({ data: {
      courseId, sectionId, position: (last?.position ?? 0) + 1, kind: question.kind, prompt: question.prompt, imageId: question.imageId,
      options: optionsJson(question.options), explanation: question.explanation,
    } });
    await audit(who, tx, "update", courseId, `Added a ${QUESTION_KIND_META[question.kind].label.toLowerCase()} question to ${section.title} in ${section.course.title}`);
    return { ok: true, id: row.id };
  });
  if (result.ok) done(courseId);
  return result;
}

export async function saveQuestion(questionId: string, input: QuestionInput): Promise<ActionResult> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  let courseId = "";
  const result = await prisma.$transaction(async (tx) => {
    const found = await questionFor(tx, who, questionId);
    if (!found) return fail("That question no longer exists.");
    courseId = found.courseId;
    const ready = await readyQuestion(tx, courseId, found.sectionId, input);
    if ("error" in ready) return fail(ready.error!);
    const { question } = ready;
    await tx.trainingQuestion.update({ where: { id: questionId }, data: {
      kind: question.kind, prompt: question.prompt, imageId: question.imageId, options: optionsJson(question.options), explanation: question.explanation,
    } });
    await audit(who, tx, "update", courseId, `Saved the question “${question.prompt.slice(0, 80)}” in ${found.course.title}`);
    return ok();
  });
  if (result.ok) done(courseId);
  return result;
}

export async function removeQuestion(questionId: string): Promise<ActionResult> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  let courseId = "";
  const result = await prisma.$transaction(async (tx) => {
    const found = await questionFor(tx, who, questionId);
    if (!found) return ok();
    courseId = found.courseId;
    await tx.trainingQuestion.delete({ where: { id: questionId } });
    await audit(who, tx, "update", courseId, `Removed the question “${found.prompt.slice(0, 80)}” from the draft of ${found.course.title}`);
    return ok();
  });
  if (result.ok && courseId) done(courseId);
  return result;
}

export async function moveQuestion(questionId: string, direction: "up" | "down"): Promise<ActionResult> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  let courseId = "";
  const result = await prisma.$transaction(async (tx) => {
    const found = await questionFor(tx, who, questionId);
    if (!found) return fail("That question no longer exists.");
    courseId = found.courseId;
    const up = direction === "up";
    const neighbour = await tx.trainingQuestion.findFirst({
      where: { sectionId: found.sectionId, position: up ? { lt: found.position } : { gt: found.position } },
      orderBy: { position: up ? "desc" : "asc" }, select: { id: true, position: true },
    });
    if (!neighbour) return ok();
    await tx.trainingQuestion.update({ where: { id: found.id }, data: { position: neighbour.position } });
    await tx.trainingQuestion.update({ where: { id: neighbour.id }, data: { position: found.position } });
    await audit(who, tx, "update", courseId, `Moved the question “${found.prompt.slice(0, 80)}” ${direction} in ${found.course.title}`);
    return ok();
  });
  if (result.ok) done(courseId);
  return result;
}

// ---------------------------------------------------------------------------
// The final exam's rules
// ---------------------------------------------------------------------------

const examSchema = z.object({
  passMark: z.number().int().min(1, "The pass mark is between 1% and 100%.").max(100, "The pass mark is between 1% and 100%."),
  attempts: z.number().int().min(1, "Allow at least one attempt.").max(10, "Allow up to 10 attempts."),
  draw: z.number().int().min(1, "Each paper needs at least one question.").max(MAX_QUESTIONS).nullable(),
  timeLimit: z.number().int().min(1, "A time limit is at least a minute.").max(240, "Keep the time limit under 4 hours.").nullable(),
  testOut: z.boolean(),
});

/** Turns the final exam on with these rules, or off (null). */
export async function saveExam(courseId: string, input: ExamSettings | null): Promise<ActionResult> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  const parsed = input ? examSchema.safeParse(input) : null;
  if (parsed && !parsed.success) return fail(parsed.error.issues[0].message);
  const exam = parsed?.data ? readExam(parsed.data) : null;
  const result = await prisma.$transaction(async (tx) => {
    const course = await courseFor(tx, who, courseId);
    if (!course) return fail("That course no longer exists.");
    await tx.trainingCourse.update({ where: { id: courseId }, data: { exam: exam ? (exam as unknown as Prisma.InputJsonValue) : Prisma.DbNull } });
    await audit(who, tx, "update", courseId, exam
      ? `Set the final exam of ${course.title}: pass mark ${exam.passMark}%, ${exam.attempts} attempts${exam.draw ? `, ${exam.draw} questions a paper` : ""}${exam.timeLimit ? `, ${exam.timeLimit} minutes` : ""}${exam.testOut ? ", test-out allowed" : ""}`
      : `Turned off the final exam of ${course.title}`);
    return ok();
  });
  if (result.ok) done(courseId);
  return result;
}


// ---------------------------------------------------------------------------
// Practical checklist (phase 5)
// ---------------------------------------------------------------------------

/** What a trainer watches for at the sign-off. A live setting: it applies to
 *  the next sign-off; each sign-off keeps its own copy of the steps. */
export async function saveObservationChecklist(courseId: string, steps: { id?: string; text: string; critical?: boolean }[]): Promise<ActionResult> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  if (!Array.isArray(steps) || steps.length > MAX_OBSERVATION_STEPS) return fail(`Keep it to ${MAX_OBSERVATION_STEPS} steps.`);
  let n = 0;
  const checklist = cleanObservation(steps, () => `s${Date.now().toString(36)}${(++n).toString(36)}`);
  const result = await prisma.$transaction(async (tx) => {
    const course = await courseFor(tx, who, courseId);
    if (!course) return fail("That course no longer exists.");
    await tx.trainingCourse.update({ where: { id: courseId }, data: { observation: checklist ? (checklist as unknown as Prisma.InputJsonValue) : Prisma.DbNull } });
    await audit(who, tx, "update", courseId, checklist
      ? `Set the practical checklist of ${course.title}: ${checklist.length} steps, ${checklist.filter((s) => s.critical).length} must be seen`
      : `Removed the practical checklist of ${course.title}`);
    return ok();
  });
  if (result.ok) done(courseId);
  return result;
}
