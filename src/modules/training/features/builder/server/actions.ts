"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTrainingActor, type TrainingActor } from "@/modules/training/shared/access";
import { cleanDoc, docImages, LESSON_KIND_META, MAX_LESSONS, MAX_SECTIONS, plainTextDoc, publishProblems, videoFor, type LessonKind } from "@/modules/training/shared/lessons";
import { refresh } from "@/modules/training/shared/writes";
import { loadDraft } from "@/modules/training/features/builder/server/draft";

/** The course builder (docs/training.md, e-learning phase 1). Building needs
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
    const row = await tx.trainingLesson.create({ data: { sectionId, kind, title: name.data, position: (last?.position ?? 0) + 1 } });
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
});
export type LessonInput = z.input<typeof lessonSchema>;

export async function saveLesson(lessonId: string, input: LessonInput): Promise<ActionResult> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  const parsed = lessonSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { title, videoUrl, fileId, minutes } = parsed.data;
  let raw: unknown = null;
  try { raw = parsed.data.body ? JSON.parse(parsed.data.body) : null; } catch { return fail("The lesson text could not be read. Reload and try again."); }
  const body = cleanDoc(raw);
  let courseId = "";
  const result = await prisma.$transaction(async (tx) => {
    const lesson = await lessonFor(tx, who, lessonId);
    if (!lesson) return fail("That lesson no longer exists.");
    courseId = lesson.section.courseId;
    if (lesson.kind === "VIDEO" && videoUrl && !videoFor(videoUrl)) return fail("Use a video link that starts https://.");
    const files = [...(lesson.kind === "FILE" && fileId ? [fileId] : []), ...docImages(body)];
    if (files.length) {
      const found = await tx.trainingFile.count({ where: { id: { in: [...new Set(files)] }, courseId } });
      if (found !== new Set(files).size) return fail("A file in this lesson is no longer available. Add it again.");
    }
    await tx.trainingLesson.update({ where: { id: lessonId }, data: {
      title, body: body ? (body as Prisma.InputJsonValue) : Prisma.DbNull,
      videoUrl: lesson.kind === "VIDEO" ? videoUrl : "", fileId: lesson.kind === "FILE" ? fileId : null, minutes,
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

/** Freezes the draft as the next version. New assignments get it, and so does
 *  anyone who has not started; people part-way through keep their version. */
export async function publishCourse(courseId: string): Promise<ActionResult> {
  const who = await author();
  if (!who) return fail(NO_RIGHT);
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "TrainingCourse" WHERE id = ${courseId} FOR UPDATE`;
    const course = await courseFor(tx, who, courseId);
    if (!course) return fail("That course no longer exists.");
    if (course.archivedAt) return fail("Restore this course before publishing it.");
    const outline = await loadDraft(tx, courseId);
    if (!outline) return fail("That course no longer exists.");
    const problems = publishProblems(outline);
    if (problems.length) return fail(problems.length === 1 ? problems[0] : `${problems[0]} (and ${problems.length - 1} more to fix)`);
    const last = await tx.trainingCourseVersion.findFirst({ where: { courseId }, orderBy: { number: "desc" }, select: { number: true } });
    const number = (last?.number ?? 0) + 1;
    const lessonCount = outline.sections.reduce((n, s) => n + s.lessons.length, 0);
    const version = await tx.trainingCourseVersion.create({ data: {
      courseId, number, outline: outline as unknown as Prisma.InputJsonValue, lessonCount, publishedById: who.id, publishedByName: who.name,
    } });
    await tx.trainingCourse.update({ where: { id: courseId }, data: { publishedVersionId: version.id } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "publish", entity: "TrainingCourse", entityId: courseId, summary: `Published version ${number} of ${course.title} (${lessonCount} lessons)` }, tx);
    return ok();
  });
  if (result.ok) done(courseId);
  return result;
}
