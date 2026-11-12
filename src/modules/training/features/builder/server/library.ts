"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { liveQualificationTypeById } from "@/lib/qualifications";
import { requireTrainingActor, type TrainingActor } from "@/modules/training/shared/access";
import { parseQuestions } from "@/modules/training/shared/import";
import { cleanDoc, cleanLessonData, docChecks, isLessonKind, lessonFiles, MAX_LESSONS, type LessonKind } from "@/modules/training/shared/lessons";
import { MAX_QUESTIONS, normaliseQuestion, questionFiles, readExam, type Question } from "@/modules/training/shared/questions";
import { templateByKey } from "@/modules/training/shared/templates";
import { refresh } from "@/modules/training/shared/writes";
import { copyFiles, remapData, remapDoc, remapOptions } from "@/modules/training/features/builder/server/copy";

/** The builder's library (e-learning phase 3): starting a
 *  course from a template or a copy, copying lessons and questions between
 *  courses, pasting questions from a spreadsheet, the cover picture, and
 *  review comments. Building needs `training.manage`; commenting needs the
 *  Trainer level or above. Every change is audited in its transaction. */

type Created = { ok: true; id: string } | Extract<ActionResult, { ok: false }>;
const NO_RIGHT = "Building courses needs the Author level in Training.";
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10);
const json = (value: unknown) => value as Prisma.InputJsonValue;

async function author() {
  const who = await requireTrainingActor();
  return who.manage && who.orgId ? who as TrainingActor & { orgId: string } : null;
}
const audit = (who: TrainingActor, tx: Prisma.TransactionClient, action: string, courseId: string, summary: string) =>
  logAudit({ actorId: who.id, actorName: who.name, action, entity: "TrainingCourse", entityId: courseId, summary }, tx);
const titleSchema = z.string().trim().min(3, "Give the course a name.").max(120, "Keep the name under 120 characters.");

const SOURCE = {
  id: true, title: true, summary: true, requiresSignoff: true, grantsTypeId: true, exam: true, coverId: true, category: true, tags: true, lessonsInOrder: true, prerequisiteIds: true,
  sections: { orderBy: { position: "asc" }, select: {
    id: true, title: true,
    lessons: { orderBy: { position: "asc" }, select: { id: true, kind: true, title: true, body: true, videoUrl: true, fileId: true, minutes: true, data: true } },
    questions: { orderBy: { position: "asc" }, select: { id: true, sectionId: true, kind: true, prompt: true, imageId: true, options: true, explanation: true } },
  } },
} as const satisfies Prisma.TrainingCourseSelect;
type SourceLesson = Prisma.TrainingCourseGetPayload<{ select: typeof SOURCE }>["sections"][number]["lessons"][number];
type SourceQuestion = Prisma.TrainingCourseGetPayload<{ select: typeof SOURCE }>["sections"][number]["questions"][number];

const asQuestion = (q: SourceQuestion) => normaliseQuestion(q, newId);
const lessonData = (l: SourceLesson) => cleanLessonData(isLessonKind(l.kind) ? l.kind : "READING", l.data);
const filesOf = (l: SourceLesson) => lessonFiles({ fileId: l.fileId, body: cleanDoc(l.body), data: lessonData(l) });

/** Creates one question in a section, with its files already remapped. */
async function createQuestion(tx: Prisma.TransactionClient, courseId: string, sectionId: string, position: number, q: Omit<Question, "id" | "sectionId">, files: ReadonlyMap<string, string>) {
  return tx.trainingQuestion.create({ data: {
    courseId, sectionId, position, kind: q.kind, prompt: q.prompt, imageId: q.imageId ? files.get(q.imageId) ?? null : null,
    options: json(remapOptions(q.options, files)), explanation: q.explanation,
  }, select: { id: true } });
}

async function createLesson(tx: Prisma.TransactionClient, sectionId: string, position: number, l: SourceLesson, files: ReadonlyMap<string, string>, questions: ReadonlyMap<string, string> | null) {
  const kind: LessonKind = isLessonKind(l.kind) ? l.kind : "READING";
  const body = remapDoc(l.body, files, questions);
  const data = remapData(lessonData(l), files);
  return tx.trainingLesson.create({ data: {
    sectionId, position, kind, title: l.title, body: body ? json(body) : Prisma.DbNull, videoUrl: l.videoUrl,
    fileId: l.fileId ? files.get(l.fileId) ?? null : null, minutes: l.minutes, data: data ? json(cleanLessonData(kind, data)) : Prisma.DbNull,
  }, select: { id: true } });
}

// ---------------------------------------------------------------------------
// Starting a course from a template or a copy
// ---------------------------------------------------------------------------

/** A new course from one of the built-in templates, opened in the builder. */
export async function createFromTemplate(key: string, title: string): Promise<Created> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  const template = templateByKey(key);
  if (!template) return fail("Choose a template.");
  const name = titleSchema.safeParse(title);
  if (!name.success) return fail(name.error.issues[0].message);
  let id = "";
  const result = await onUniqueViolation(() => prisma.$transaction(async (tx) => {
    const course = await tx.trainingCourse.create({ data: {
      orgId: who.orgId, title: name.data, requiresSignoff: template.requiresSignoff, exam: template.exam ? json(template.exam) : Prisma.DbNull, createdById: who.id,
    }, select: { id: true } });
    id = course.id;
    for (const [si, section] of template.sections.entries()) {
      const row = await tx.trainingSection.create({ data: { courseId: id, title: section.title, position: si + 1 }, select: { id: true } });
      for (const [li, lesson] of section.lessons.entries()) {
        const body = cleanDoc(lesson.body ?? null), data = cleanLessonData(lesson.kind, lesson.data ?? null);
        await tx.trainingLesson.create({ data: { sectionId: row.id, position: li + 1, kind: lesson.kind, title: lesson.title, minutes: lesson.minutes ?? null,
          body: body ? json(body) : Prisma.DbNull, data: data ? json(data) : Prisma.DbNull } });
      }
    }
    await audit(who, tx, "create", id, `Added the course ${name.data} from the template ${template.title}`);
    return ok();
  }), "There is already a course with that name.", "title");
  if (!result.ok) return result;
  refresh("/training/courses");
  return { ok: true, id };
}

/** A full copy of a course's draft, its settings and files, under a new name.
 *  Nobody is assigned to the copy and it starts unpublished. */
export async function duplicateCourse(courseId: string, title: string): Promise<Created> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  const name = titleSchema.safeParse(title);
  if (!name.success) return fail(name.error.issues[0].message);
  let id = "";
  const result = await onUniqueViolation(() => prisma.$transaction(async (tx) => {
    const source = await tx.trainingCourse.findFirst({ where: { id: courseId, orgId: who.orgId }, select: SOURCE });
    if (!source) return fail("That course no longer exists.");
    const grants = source.grantsTypeId && await liveQualificationTypeById(source.grantsTypeId, who.orgId, tx) ? source.grantsTypeId : null;
    const course = await tx.trainingCourse.create({ data: {
      orgId: who.orgId, title: name.data, summary: source.summary, requiresSignoff: source.requiresSignoff, grantsTypeId: grants,
      exam: readExam(source.exam) ? json(readExam(source.exam)) : Prisma.DbNull, category: source.category, tags: source.tags, createdById: who.id,
      lessonsInOrder: source.lessonsInOrder, prerequisiteIds: source.prerequisiteIds,
    }, select: { id: true } });
    id = course.id;
    const lessons = source.sections.flatMap((s) => s.lessons), questions = source.sections.flatMap((s) => s.questions).map(asQuestion).filter((q): q is Question => !!q);
    const files = await copyFiles(tx, who.orgId, id, [...lessons.flatMap(filesOf), ...questions.flatMap(questionFiles), ...(source.coverId ? [source.coverId] : [])], who);
    if (source.coverId && files.get(source.coverId)) await tx.trainingCourse.update({ where: { id }, data: { coverId: files.get(source.coverId) } });
    // Questions first, so knowledge checks in the lessons can point at their copies.
    const questionIds = new Map<string, string>(), sectionIds: string[] = [];
    for (const [si, section] of source.sections.entries()) {
      const row = await tx.trainingSection.create({ data: { courseId: id, title: section.title, position: si + 1 }, select: { id: true } });
      sectionIds.push(row.id);
      for (const [qi, q] of section.questions.map(asQuestion).entries()) {
        if (q) questionIds.set(q.id, (await createQuestion(tx, id, row.id, qi + 1, q, files)).id);
      }
    }
    for (const [si, section] of source.sections.entries()) {
      for (const [li, lesson] of section.lessons.entries()) await createLesson(tx, sectionIds[si], li + 1, lesson, files, questionIds);
    }
    await audit(who, tx, "create", id, `Added the course ${name.data} as a copy of ${source.title}`);
    return ok();
  }), "There is already a course with that name.", "title");
  if (!result.ok) return result;
  refresh("/training/courses");
  return { ok: true, id };
}

// ---------------------------------------------------------------------------
// Copying lessons and questions in from another course
// ---------------------------------------------------------------------------

/** Another course's sections, lessons and questions by name, to choose what to copy. */
export async function courseToCopyFrom(courseId: string) {
  const who = await author();
  if (!who) return null;
  const course = await prisma.trainingCourse.findFirst({ where: { id: courseId, orgId: who.orgId }, select: {
    id: true, title: true,
    sections: { orderBy: { position: "asc" }, select: {
      id: true, title: true,
      lessons: { orderBy: { position: "asc" }, select: { id: true, kind: true, title: true } },
      questions: { orderBy: { position: "asc" }, select: { id: true, kind: true, prompt: true } },
    } },
  } });
  return course && { id: course.id, title: course.title, sections: course.sections.map((s) => ({
    id: s.id, title: s.title, lessons: s.lessons.filter((l) => isLessonKind(l.kind)).map((l) => ({ id: l.id, kind: l.kind as LessonKind, title: l.title })),
    questions: s.questions.map((q) => ({ id: q.id, prompt: q.kind === "FILL_BLANK" ? q.prompt.replace(/\[[^\]]*\]/g, "____") : q.prompt })),
  })) };
}

/** Copies lessons and questions from a course into one section of this draft.
 *  Questions a copied lesson's knowledge checks ask come along too. */
export async function copyIntoSection(sectionId: string, sourceCourseId: string, lessonIds: string[], questionIds: string[]): Promise<ActionResult> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  const lessonSet = new Set(lessonIds.slice(0, MAX_LESSONS)), questionSet = new Set(questionIds.slice(0, MAX_QUESTIONS));
  if (!lessonSet.size && !questionSet.size) return fail("Choose at least one lesson or question to copy.");
  let courseId = "";
  const result = await prisma.$transaction(async (tx) => {
    const target = await tx.trainingSection.findFirst({ where: { id: sectionId, course: { orgId: who.orgId } }, select: { id: true, title: true, courseId: true, course: { select: { title: true, archivedAt: true } } } });
    if (!target) return fail("That section no longer exists.");
    if (target.course.archivedAt) return fail("Restore this course before changing it.");
    courseId = target.courseId;
    const source = await tx.trainingCourse.findFirst({ where: { id: sourceCourseId, orgId: who.orgId }, select: SOURCE });
    if (!source) return fail("The course to copy from no longer exists.");
    const lessons = source.sections.flatMap((s) => s.lessons).filter((l) => lessonSet.has(l.id));
    const sameCourse = source.id === target.courseId;
    // Knowledge checks in a copied lesson need their questions in this course.
    for (const l of lessons) for (const qid of docChecks(cleanDoc(l.body))) if (!sameCourse) questionSet.add(qid);
    const questions = source.sections.flatMap((s) => s.questions).filter((q) => questionSet.has(q.id)).map(asQuestion).filter((q): q is Question => !!q);
    if (!lessons.length && !questions.length) return fail("Those lessons and questions are no longer in that course.");
    const [lessonCount, questionCount] = await Promise.all([
      tx.trainingLesson.count({ where: { section: { courseId } } }), tx.trainingQuestion.count({ where: { courseId } }),
    ]);
    if (lessonCount + lessons.length > MAX_LESSONS) return fail(`A course can have up to ${MAX_LESSONS} lessons.`);
    if (questionCount + questions.length > MAX_QUESTIONS) return fail(`A course can have up to ${MAX_QUESTIONS} questions.`);
    const files = await copyFiles(tx, who.orgId, courseId, [...lessons.flatMap(filesOf), ...questions.flatMap(questionFiles)], who);
    const lastQ = await tx.trainingQuestion.findFirst({ where: { sectionId }, orderBy: { position: "desc" }, select: { position: true } });
    const qMap = new Map<string, string>();
    for (const [i, q] of questions.entries()) qMap.set(q.id, (await createQuestion(tx, courseId, sectionId, (lastQ?.position ?? 0) + i + 1, q, files)).id);
    const lastL = await tx.trainingLesson.findFirst({ where: { sectionId }, orderBy: { position: "desc" }, select: { position: true } });
    for (const [i, l] of lessons.entries()) await createLesson(tx, sectionId, (lastL?.position ?? 0) + i + 1, l, files, sameCourse ? null : qMap);
    await audit(who, tx, "update", courseId, `Copied ${[lessons.length ? `${lessons.length} ${lessons.length === 1 ? "lesson" : "lessons"}` : null, questions.length ? `${questions.length} ${questions.length === 1 ? "question" : "questions"}` : null].filter(Boolean).join(" and ")} from ${source.title} into ${target.title} in ${target.course.title}`);
    return ok();
  });
  if (result.ok) refresh("/training/courses", `/training/courses/${courseId}`);
  return result;
}

// ---------------------------------------------------------------------------
// Questions pasted from a spreadsheet
// ---------------------------------------------------------------------------

/** Adds every question it can read from the pasted rows. The builder shows
 *  which rows it can't read before this is sent. */
export async function importQuestions(sectionId: string, text: string): Promise<{ ok: true; added: number; skipped: number } | Extract<ActionResult, { ok: false }>> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  if (text.length > 200_000) return fail("That is too much to paste at once. Paste up to 100 rows.");
  const { questions, problems } = parseQuestions(text, newId);
  if (!questions.length) return fail(problems[0] ? `Row ${problems[0].row}: ${problems[0].message}` : "Paste at least one row.");
  let courseId = "";
  const result = await prisma.$transaction(async (tx) => {
    const section = await tx.trainingSection.findFirst({ where: { id: sectionId, course: { orgId: who.orgId } }, select: { title: true, courseId: true, course: { select: { title: true, archivedAt: true } } } });
    if (!section) return fail("That section no longer exists.");
    if (section.course.archivedAt) return fail("Restore this course before changing it.");
    courseId = section.courseId;
    if (await tx.trainingQuestion.count({ where: { courseId } }) + questions.length > MAX_QUESTIONS) return fail(`A course can have up to ${MAX_QUESTIONS} questions.`);
    const last = await tx.trainingQuestion.findFirst({ where: { sectionId }, orderBy: { position: "desc" }, select: { position: true } });
    for (const [i, q] of questions.entries()) await createQuestion(tx, courseId, sectionId, (last?.position ?? 0) + i + 1, q, new Map());
    await audit(who, tx, "update", courseId, `Added ${questions.length} pasted ${questions.length === 1 ? "question" : "questions"} to ${section.title} in ${section.course.title}`);
    return ok();
  });
  if (!result.ok) return result;
  refresh(`/training/courses/${courseId}`);
  return { ok: true, added: questions.length, skipped: problems.length };
}

// ---------------------------------------------------------------------------
// The cover picture
// ---------------------------------------------------------------------------

/** Sets the course's cover to one of its pictures, or takes it off (null). */
export async function setCourseCover(courseId: string, fileId: string | null): Promise<ActionResult> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  const result = await prisma.$transaction(async (tx) => {
    const course = await tx.trainingCourse.findFirst({ where: { id: courseId, orgId: who.orgId }, select: { title: true } });
    if (!course) return fail("That course no longer exists.");
    if (fileId && !(await tx.trainingFile.findFirst({ where: { id: fileId, courseId, mime: { startsWith: "image/" } }, select: { id: true } }))) return fail("Choose a picture from this course.");
    await tx.trainingCourse.update({ where: { id: courseId }, data: { coverId: fileId } });
    await audit(who, tx, "update", courseId, fileId ? `Set the cover picture of ${course.title}` : `Took the cover picture off ${course.title}`);
    return ok();
  });
  if (result.ok) refresh("/training/courses", `/training/courses/${courseId}`);
  return result;
}

// ---------------------------------------------------------------------------
// Review comments
// ---------------------------------------------------------------------------

async function reviewer() {
  const who = await requireTrainingActor();
  return (who.manage || who.signoff) && who.orgId ? who as TrainingActor & { orgId: string } : null;
}
const NO_REVIEW = "Commenting on courses needs the Trainer level in Training.";

/** A comment on the draft: on one lesson, or the course as a whole. */
export async function addReviewComment(courseId: string, lessonId: string | null, body: string): Promise<ActionResult> {
  const who = await reviewer();
  if (!who) return fail(NO_REVIEW);
  const text = body.trim();
  if (text.length < 2) return fail("Write the comment.");
  if (text.length > 1000) return fail("Keep a comment under 1,000 characters.");
  const result = await prisma.$transaction(async (tx) => {
    const course = await tx.trainingCourse.findFirst({ where: { id: courseId, orgId: who.orgId }, select: { title: true } });
    if (!course) return fail("That course no longer exists.");
    const lesson = lessonId ? await tx.trainingLesson.findFirst({ where: { id: lessonId, section: { courseId } }, select: { title: true } }) : null;
    if (lessonId && !lesson) return fail("That lesson is no longer in the draft.");
    await tx.trainingReviewComment.create({ data: { courseId, lessonId, body: text, authorId: who.id, authorName: who.name } });
    await audit(who, tx, "comment", courseId, `Commented on ${lesson ? `the lesson ${lesson.title} in ` : ""}${course.title}`);
    return ok();
  });
  if (result.ok) refresh(`/training/courses/${courseId}`);
  return result;
}

/** Marks a comment as dealt with. Comments are kept, never deleted. */
export async function resolveReviewComment(commentId: string): Promise<ActionResult> {
  const who = await reviewer();
  if (!who) return fail(NO_REVIEW);
  let courseId = "";
  const result = await prisma.$transaction(async (tx) => {
    const comment = await tx.trainingReviewComment.findFirst({ where: { id: commentId, course: { orgId: who.orgId } }, select: { courseId: true, resolvedAt: true, body: true, course: { select: { title: true } } } });
    if (!comment) return fail("That comment no longer exists.");
    courseId = comment.courseId;
    if (comment.resolvedAt) return ok();
    await tx.trainingReviewComment.update({ where: { id: commentId }, data: { resolvedAt: new Date(), resolvedById: who.id, resolvedByName: who.name } });
    await audit(who, tx, "update", courseId, `Marked a comment on ${comment.course.title} as done: “${comment.body.slice(0, 60)}”`);
    return ok();
  });
  if (result.ok && courseId) refresh(`/training/courses/${courseId}`);
  return result;
}
