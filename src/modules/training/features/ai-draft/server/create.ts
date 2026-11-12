import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { EXAM_DEFAULTS } from "@/modules/training/shared/questions";
import { refresh } from "@/modules/training/shared/writes";
import { DraftError, draftFromDocument, type Source } from "@/modules/training/features/ai-draft/server/claude";
import { toCourse } from "@/modules/training/features/ai-draft/server/to-course";

/** Drafting a course from a document (AI drafting). Needs the
 *  Author level. The course lands unpublished, with a review comment listing
 *  what to check, so an author reads every lesson in the builder before anyone
 *  is assigned it. Audited; ten drafts an hour per person. */

export const PER_HOUR = 10;
const AI_MARK = "(AI draft)";
const json = (value: unknown) => value as Prisma.InputJsonValue;

/** A name no other course in the organisation has: "SOP" then "SOP (2)". */
async function freeTitle(orgId: string, wanted: string) {
  const base = (wanted || "Course from a document").slice(0, 110);
  const taken = new Set((await prisma.trainingCourse.findMany({ where: { orgId, title: { startsWith: base } }, select: { title: true } })).map((c) => c.title));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n++) if (!taken.has(`${base} (${n})`)) return `${base} (${n})`;
  return `${base} (${Date.now() % 10000})`;
}

export async function draftCourse(source: Source, options: { title: string; exam: boolean; practice: boolean }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const who = await requireTrainingActor();
  if (!who.manage || !who.orgId) return { ok: false, error: "Building courses needs the Author level in Training." };
  const orgId = who.orgId;
  // Each draft leaves its "what to check" comment, so those count the drafts.
  const recent = await prisma.trainingReviewComment.count({ where: { authorId: who.id, authorName: { endsWith: AI_MARK }, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
  if (recent >= PER_HOUR) return { ok: false, error: `You can draft ${PER_HOUR} courses an hour. Try again later.` };
  let result;
  try { result = await draftFromDocument(source, options); }
  catch (error) { return { ok: false, error: error instanceof DraftError ? error.message : "The AI didn’t answer. Try again." }; }
  const course = toCourse(result.draft, { practice: options.practice });
  if (!course.sections.length) return { ok: false, error: "The AI couldn’t find enough in that document to make a course." };
  const title = await freeTitle(orgId, options.title.trim() || course.title);
  const questions = course.sections.reduce((n, s) => n + s.questions.length, 0);
  const id = await prisma.$transaction(async (tx) => {
    const row = await tx.trainingCourse.create({ data: {
      orgId, title, summary: course.summary, category: course.category, requiresSignoff: false, createdById: who.id,
      exam: options.exam && questions >= 5 ? json(EXAM_DEFAULTS) : Prisma.DbNull,
    }, select: { id: true } });
    for (const [si, section] of course.sections.entries()) {
      const s = await tx.trainingSection.create({ data: { courseId: row.id, title: section.title, position: si + 1 }, select: { id: true } });
      for (const [li, l] of section.lessons.entries()) {
        await tx.trainingLesson.create({ data: { sectionId: s.id, position: li + 1, kind: l.kind, title: l.title, minutes: l.minutes,
          body: l.body ? json(l.body) : Prisma.DbNull, data: l.data ? json(l.data) : Prisma.DbNull } });
      }
      for (const [qi, q] of section.questions.entries()) {
        await tx.trainingQuestion.create({ data: { courseId: row.id, sectionId: s.id, position: qi + 1, kind: q.kind, prompt: q.prompt, imageId: null, options: json(q.options), explanation: q.explanation } });
      }
    }
    // What to check, where the builder shows it: a review comment on the course.
    const check = [
      `Drafted by AI from ${result.name}. Read every lesson and question against the document before publishing.`,
      ...course.notes.map((n) => `• ${n}`),
      ...(course.dropped.length ? [`Left out because they were incomplete: ${course.dropped.slice(0, 8).join(", ")}.`] : []),
    ].join("\n").slice(0, 1000);
    await tx.trainingReviewComment.create({ data: { courseId: row.id, lessonId: null, body: check, authorId: who.id, authorName: `${who.name} ${AI_MARK}` } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "ai-draft", entity: "TrainingCourse", entityId: row.id,
      summary: `Drafted the course ${title} with AI from ${result.name.slice(0, 120)}: ${course.sections.length} sections, ${questions} questions, unpublished` }, tx);
    return row.id;
  });
  refresh("/training/courses");
  return { ok: true, id };
}
