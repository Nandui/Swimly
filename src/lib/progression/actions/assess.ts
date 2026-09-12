"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { can, canSee, requirePermission } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { readSharedCurriculum, liveSharedLevel } from "@/lib/curriculum/data/shared";
import { latestSharedMarks } from "@/lib/curriculum/shared";
import { formatDate, parseDateOnly, today } from "@/lib/format";
import { completionProgress } from "@/lib/progression/rules";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";
import { teachingError, type TeachingContext } from "@/lib/attendance/teaching";
import { isDateOnly } from "@/lib/format";

const markSchema = z.object({ competencyId: z.string().min(1), status: z.enum(["WORKING_ON", "ACHIEVED"]).nullable() });
const assessSchema = z.object({ studentId: z.string().min(1), levelId: z.string().min(1), results: z.array(markSchema).max(100) });
const classAssessSchema = z.object({ levelId: z.string().min(1), marks: z.array(markSchema.extend({ studentId: z.string().min(1) })).min(1, "Nothing to save.").max(2000) });
export type AssessInput = z.infer<typeof assessSchema>;
export type ClassAssessInput = z.infer<typeof classAssessSchema>;
type Assessor = { id: string; name?: string | null };

function revalidate() {
  revalidatePath("/students/[id]", "page");
  revalidatePath("/courses/[id]/assess", "page");
  revalidatePath("/courses/[id]/class", "page");
  revalidatePath("/instructor/classes/[id]", "page");
}

/** All progress writes take the swimmer lock, so simultaneous saves and
 * completion decisions at either site see the same current judgements. */
async function saveMarks(tx: Prisma.TransactionClient, levelId: string, input: ClassAssessInput["marks"], actor: Assessor, clubId: string, teaching?: TeachingContext): Promise<ActionResult> {
  const studentIds = [...new Set(input.map(m => m.studentId))].sort();
  for (const id of studentIds) await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${id} FOR UPDATE`;
  const curriculum = await readSharedCurriculum(tx);
  const level = liveSharedLevel(curriculum, levelId);
  if (!level) return fail("That level or its programme is archived or no longer exists.");
  if (teaching) {
    const course = await tx.course.findUnique({ where: { id: teaching.courseId }, select: { levelId: true } });
    if (!course || curriculum.levelIds.resolve(course.levelId) !== level.id) return fail("The class level has changed. Reload the checklist.");
  }
  const marks = input.map(m => ({ ...m, competencyId: curriculum.competencyIds.resolve(m.competencyId) }));
  const key = (m: { studentId: string; competencyId: string }) => `${m.studentId}:${m.competencyId}`;
  if (new Set(marks.map(key)).size !== marks.length) return fail("A mark appears twice. Reload and try again.");
  const names = new Map(level.competencies.map(c => [c.id, c.name]));
  if (marks.some(m => !names.has(m.competencyId))) return fail("Something on that checklist is not part of this level. Reload and try again.");
  const students = await tx.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, firstName: true, lastName: true } });
  if (students.length !== studentIds.length) return fail("A swimmer on that list no longer exists. Reload and try again.");
  const existing = await tx.competencyResult.findMany({ where: { studentId: { in: studentIds }, competencyId: { in: [...names.keys()].flatMap(curriculum.competencyIds.variants) } } });
  const before = new Map(studentIds.flatMap(id => latestSharedMarks(existing.filter(r => r.studentId === id), curriculum.competencyIds.resolve)).map(r => [key(r), r.status]));
  const changed = marks.filter(m => (before.get(key(m)) ?? null) !== m.status);
  if (!changed.length) return ok();
  const assessedOn = parseDateOnly(teaching?.date ?? today()), assessedByName = actor.name ?? "Unknown";
  for (const mark of changed) {
    if (mark.status === null) {
      // Clearing a shared mark must clear its original copies too, otherwise
      // the previous site's judgement would reappear on the next read.
      await tx.competencyResult.deleteMany({ where: { studentId: mark.studentId, competencyId: { in: curriculum.competencyIds.variants(mark.competencyId) } } });
    } else {
      const data = { status: mark.status, assessedOn, assessedById: actor.id, assessedByName, ...(teaching ? { assessedInCourseId: teaching.courseId } : {}) };
      await tx.competencyResult.upsert({ where: { studentId_competencyId: { studentId: mark.studentId, competencyId: mark.competencyId } },
        create: { studentId: mark.studentId, competencyId: mark.competencyId, ...data }, update: data });
    }
  }
  for (const student of students) {
    const rows = changed.filter(m => m.studentId === student.id);
    if (!rows.length) continue;
    const parts = (["ACHIEVED", "WORKING_ON", null] as const).flatMap(status => {
      const labels = rows.filter(m => m.status === status).map(m => names.get(m.competencyId)!);
      if (!labels.length) return [];
      const list = labels.slice(0, 6).join(", ") + (labels.length > 6 ? ` and ${labels.length - 6} others` : "");
      return [`${status === "ACHIEVED" ? "passed" : status === "WORKING_ON" ? "not achieved" : "unmarked"} ${list}`];
    });
    await logAudit({ actorId: actor.id, actorName: assessedByName, action: "assess", entity: "Student", entityId: student.id,
      details: { version: 1, kind: "competencies", date: teaching?.date ?? today(), levelId: level.id, courseId: teaching?.courseId ?? null,
        changes: rows.map(mark => ({ competencyId: mark.competencyId, name: names.get(mark.competencyId)!, before: before.get(key(mark)) ?? null, after: mark.status })) },
      programmeId: level.programmeId, clubId, summary: `${fullName(student)} in ${level.name} — ${parts.join("; ")}` }, tx);
  }
  return ok();
}

export async function saveAssessment(input: AssessInput): Promise<ActionResult> {
  const session = await requirePermission("progression.assess");
  if (!canSee(session, "students")) return fail("Open your class in Instructor to mark competencies.");
  const parsed = assessSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const clubId = await currentClubId();
  const { studentId, levelId, results } = parsed.data;
  const result = await prisma.$transaction(tx => saveMarks(tx, levelId, results.map(m => ({ ...m, studentId })), session.user, clubId), { timeout: 15_000 });
  if (result.ok) revalidate();
  return result;
}

export async function saveClassAssessment(input: ClassAssessInput): Promise<ActionResult> {
  const session = await requirePermission("progression.assess");
  if (!canSee(session, "courses")) return fail("Open your class in Instructor to mark competencies.");
  const parsed = classAssessSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const clubId = await currentClubId();
  const result = await prisma.$transaction(tx => saveMarks(tx, parsed.data.levelId, parsed.data.marks, session.user, clubId), { timeout: 15_000 });
  if (result.ok) revalidate();
  return result;
}

const teachingSchema = z.object({ courseId: z.string().min(1), date: z.string().refine(isDateOnly, "That is not a date.") });
const instructorAssessSchema = classAssessSchema.extend(teachingSchema.shape);
export async function saveInstructorAssessment(input: z.infer<typeof instructorAssessSchema>): Promise<ActionResult> {
  const session = await requirePermission("progression.assess");
  const parsed = instructorAssessSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const value = parsed.data, clubId = await currentClubId();
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Course" WHERE id = ${value.courseId} FOR UPDATE`;
    const error = await teachingError(tx, session, value, clubId, value.marks.map(m => m.studentId));
    if (error) return fail(error);
    return saveMarks(tx, value.levelId, value.marks, session.user, clubId, value);
  }, { timeout: 15_000 });
  if (result.ok) revalidate();
  return result;
}

const confirmSchema = z.object({ studentId: z.string().min(1), levelId: z.string().min(1), note: z.string().trim().max(300), overrideReason: z.string().trim().max(300), teaching: teachingSchema.optional() });
export async function confirmLevelCompletion(input: z.infer<typeof confirmSchema>): Promise<ActionResult> {
  const session = await requirePermission("progression.complete");
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  if (!parsed.data.teaching && !canSee(session, "students") && !canSee(session, "courses")) return fail("Open your class in Instructor to complete this level.");
  const { studentId, note, overrideReason } = parsed.data;
  const clubId = await currentClubId();
  const result = await prisma.$transaction(async (tx): Promise<ActionResult> => {
    if (parsed.data.teaching) {
      const context = parsed.data.teaching;
      await tx.$queryRaw`SELECT id FROM "Course" WHERE id = ${context.courseId} FOR UPDATE`;
      const error = await teachingError(tx, session, context, clubId, [studentId]);
      if (error) return fail(error);
    }
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${studentId} FOR UPDATE`;
    const curriculum = await readSharedCurriculum(tx);
    const level = liveSharedLevel(curriculum, parsed.data.levelId);
    const student = await tx.student.findUnique({ where: { id: studentId }, select: { firstName: true, lastName: true } });
    if (!student) return fail("That swimmer no longer exists.");
    if (!level) return fail("That level or its programme is archived or no longer exists.");
    if (parsed.data.teaching) {
      const course = await tx.course.findUnique({ where: { id: parsed.data.teaching.courseId }, select: { levelId: true } });
      if (!course || curriculum.levelIds.resolve(course.levelId) !== level.id) return fail("The class level has changed. Reload before completing it.");
    }
    const already = await tx.levelCompletion.findFirst({ where: { studentId, levelId: { in: curriculum.levelIds.variants(level.id) } }, select: { id: true } });
    if (already) return fail(`${fullName(student)} has already completed ${level.name}.`);
    const results = await tx.competencyResult.findMany({ where: { studentId, competencyId: { in: level.competencies.flatMap(c => curriculum.competencyIds.variants(c.id)) } } });
    const achieved = new Set(latestSharedMarks(results, curriculum.competencyIds.resolve).filter(r => r.status === "ACHIEVED").map(r => r.competencyId));
    const progress = completionProgress(level.competencies.map(c => c.id), achieved);
    if (!progress.total) return fail(`${level.name} has no competencies yet, so there is nothing to have passed.`);
    if (!progress.eligible && !can(session, "progression.override")) return fail(`${fullName(student)} has ${progress.achieved} of ${progress.total}. Only someone allowed to complete a level with gaps can do that.`);
    if (!progress.eligible && !overrideReason) return fail(`${fullName(student)} has ${progress.achieved} of ${progress.total}. Say why the level is being completed anyway.`);
    const completedOn = parseDateOnly(today()), confirmedByName = session.user.name ?? "Unknown";
    await tx.levelCompletion.create({ data: { studentId, levelId: level.id, programmeId: level.programmeId, completedOn,
      competenciesAchieved: progress.achieved, competencyCount: progress.total, overrideReason: progress.eligible ? null : overrideReason,
      confirmedById: session.user.id, confirmedByName, note: note || null } });
    await logAudit({ actorId: session.user.id, actorName: confirmedByName, action: "complete-level", entity: "Student", entityId: studentId,
      details: { version: 1, kind: "completion", date: today(), levelId: level.id, courseId: parsed.data.teaching?.courseId ?? null, achieved: progress.achieved, total: progress.total, note, overrideReason: progress.eligible ? null : overrideReason },
      programmeId: level.programmeId, clubId, summary: `${fullName(student)} completed ${level.name} on ${formatDate(completedOn)} (${progress.achieved} of ${progress.total})` + (progress.eligible ? "" : ` — confirmed with gaps: ${overrideReason}`) }, tx);
    return ok();
  }, { timeout: 15_000 });
  if (result.ok) revalidate();
  return result;
}

const revokeSchema = z.object({ reason: z.string().trim().min(1, "Say why the completion is being taken back.") });
export async function revokeLevelCompletion(id: string, input: z.infer<typeof revokeSchema>): Promise<ActionResult> {
  const session = await requirePermission("progression.override");
  if (!canSee(session, "students") && !canSee(session, "courses")) return fail("Level corrections require access to the desk workspace.");
  const parsed = revokeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const source = await prisma.levelCompletion.findUnique({ where: { id }, select: { studentId: true } });
  if (!source) return fail("That completion no longer exists.");
  const result = await prisma.$transaction(async (tx): Promise<ActionResult> => {
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${source.studentId} FOR UPDATE`;
    const completion = await tx.levelCompletion.findUnique({ where: { id }, include: { student: { select: { firstName: true, lastName: true } }, level: { select: { name: true } } } });
    if (!completion) return fail("That completion no longer exists.");
    const curriculum = await readSharedCurriculum(tx);
    const copies = await tx.levelCompletion.findMany({ where: { studentId: completion.studentId, levelId: { in: curriculum.levelIds.variants(completion.levelId) } } });
    for (const copy of copies) {
      await tx.levelCompletion.delete({ where: { id: copy.id } });
      await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: "revoke-level", entity: "Student", entityId: completion.studentId,
        details: { version: 1, kind: "completion", levelId: curriculum.levelIds.resolve(copy.levelId), date: today(), reason: parsed.data.reason, revoked: true },
        programmeId: curriculum.programmeIds.resolve(copy.programmeId), clubId: null,
        summary: `Took back ${fullName(completion.student)}'s completion of ${curriculum.level(copy.levelId)?.name ?? completion.level.name} from ${formatDate(copy.completedOn)} (record ${copy.id}) — ${parsed.data.reason}` }, tx);
    }
    return ok();
  }, { timeout: 15_000 });
  if (result.ok) revalidate();
  return result;
}
