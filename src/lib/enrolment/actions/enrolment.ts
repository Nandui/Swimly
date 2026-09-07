"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { fail, ok, type ActionResult, type ConfirmationReply } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { capacityLabel, courseLabel } from "@/lib/courses/constants";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { parseDateOnly, today } from "@/lib/format";
import { hasEarnedPlace, previousLevel } from "@/lib/progression/rules";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

const placementReasonSchema = z.string().trim().max(300, "Keep the reason under 300 characters.");
const enrolSchema = z.object({
  studentId: z.string().min(1, "Pick a swimmer."),
  courseId: z.string().min(1, "Pick a class."),
  placementReason: placementReasonSchema,
  allowWaitlist: z.boolean(),
});
export type EnrolInput = z.infer<typeof enrolSchema>;

const COURSE_SELECT = {
  id: true, clubId: true, name: true, dayOfWeek: true, startMinutes: true,
  capacity: true, archivedAt: true, levelId: true,
  level: { select: { id: true, name: true, archivedAt: true, programmeId: true, programme: { select: { archivedAt: true } } } },
} as const satisfies Prisma.CourseSelect;

const ENROLMENT_SELECT = {
  id: true, status: true, studentId: true, courseId: true, programmeId: true,
  placementReason: true,
  student: { select: { firstName: true, lastName: true, status: true, clubId: true } },
  course: { select: COURSE_SELECT },
} as const satisfies Prisma.EnrolmentSelect;

/** Re-read placement against the locked class; a changed timetable cannot
 *  leave a new enrolment pinned to an old level. Transfers use the same rule. */
async function placementFor(
  tx: Prisma.TransactionClient,
  studentId: string,
  course: Prisma.CourseGetPayload<{ select: typeof COURSE_SELECT }>
) {
  const programmeId = course.level.programmeId;
  const [orderedLevels, completions, actives, assessments] = await Promise.all([
    tx.level.findMany({
      where: { programmeId, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, sortOrder: true },
    }),
    tx.levelCompletion.findMany({ where: { studentId, programmeId }, select: { levelId: true } }),
    tx.enrolment.findMany({ where: { studentId, programmeId, status: "ACTIVE" }, select: { levelId: true } }),
    tx.assessmentBooking.findMany({
      where: { studentId, status: "ATTENDED", outcomeLevelId: { not: null }, session: { programmeId } },
      select: { outcomeLevelId: true },
    }),
  ]);
  return {
    earned: hasEarnedPlace({
      targetLevelId: course.levelId, orderedLevels,
      completedLevelIds: new Set(completions.map((row) => row.levelId)),
      activeLevelIds: new Set(actives.map((row) => row.levelId)),
      assessedLevelIds: new Set(assessments.flatMap((row) => row.outcomeLevelId ? [row.outcomeLevelId] : [])),
    }),
    below: previousLevel(course.levelId, orderedLevels),
  };
}

function revalidate() {
  revalidatePath("/reception");
  revalidatePath("/courses");
  revalidatePath("/courses/[id]", "page");
  revalidatePath("/students/[id]", "page");
  revalidatePath("/today");
}

export async function enrolStudent(input: EnrolInput, confirmation?: ConfirmationReply): Promise<ActionResult> {
  const session = await requirePermission("enrolment.manage");
  const parsed = enrolSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { studentId, courseId, placementReason, allowWaitlist } = parsed.data;
  const clubId = await currentClubId();
  const reply = z.object({ choice: z.enum(["keep", "withdraw"]), ids: z.array(z.string().min(1)).max(100) }).optional().safeParse(confirmation);
  if (!reply.success) return fail("Choose whether to keep the existing places or unenrol.");
  const existingWhere = { studentId, courseId: { not: courseId }, status: "ACTIVE" as const, course: { clubId }, student: { clubId } };
  // Lock the source classes in the same order as transfers, before the swimmer.
  const sources = await prisma.enrolment.findMany({ where: existingWhere, select: { courseId: true } });

  const result = await withCourseSeat([courseId, ...sources.map((row) => row.courseId)], async (tx): Promise<ActionResult> => {
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${studentId} FOR UPDATE`;
    const [student, course] = await Promise.all([
      tx.student.findUnique({
        where: { id: studentId, clubId },
        select: { id: true, firstName: true, lastName: true, status: true },
      }),
      tx.course.findUnique({ where: { id: courseId, clubId }, select: COURSE_SELECT }),
    ]);
    if (!student) return fail("That swimmer is not available in this club.");
    if (student.status !== "ACTIVE") return fail(`${fullName(student)} is marked inactive.`);
    if (!course) return fail("That class is not available in this club.");
    if (course.archivedAt) return fail("That class is archived.");
    if (course.level.archivedAt || course.level.programme.archivedAt) return fail("That class's level or programme is archived. Restore it first.");
    const open = await tx.enrolment.findFirst({
      where: { studentId, courseId, status: { in: ["ACTIVE", "WAITLISTED"] } }, select: { status: true },
    });
    if (open) return fail(open.status === "ACTIVE"
      ? `${fullName(student)} is already in that class.`
      : `${fullName(student)} is already on the waitlist for that class.`);

    const { earned, below } = await placementFor(tx, studentId, course);
    if (!earned && !placementReason) return fail(
      `${fullName(student)} has not completed ${below?.name ?? "the level below"} and no assessment has placed them at ${course.level.name}. Say why they are being placed there and it will go on their record.`
    );
    const taken = await tx.enrolment.count({ where: { courseId, status: "ACTIVE" } });
    const full = course.capacity !== null && taken >= course.capacity;
    if (full && !allowWaitlist) return fail(
      `${courseLabel(course)} is full (${capacityLabel(taken, course.capacity)}). Tick the waitlist box to put them on it.`
    );
    const existing = await tx.enrolment.findMany({
      where: existingWhere, select: { id: true, courseId: true, programmeId: true, course: { select: COURSE_SELECT } },
      orderBy: { id: "asc" },
    });
    const decision = reply.data;
    const matches = decision && decision.ids.length === existing.length && existing.every((row) => decision.ids.includes(row.id));
    if (existing.length && (!matches || (full && decision?.choice === "withdraw") || existing.some((row) => !sources.some((source) => source.courseId === row.courseId)))) {
      return {
        ok: false, error: "Choose what to do with the existing places.",
        confirmation: {
          title: "Unenrol from the previous class?",
          description: `${fullName(student)} is already enrolled in: ${existing.map((row) => `${courseLabel(row.course)} (${row.course.level.name})`).join("; ")}. ` +
            (full ? "The new class is full. Joining its waitlist keeps these places." : "Keep these places, or end them when enrolling in the new class. Attendance and marks stay on record."),
          ids: existing.map((row) => row.id),
          choices: full ? [{ label: "Keep places and join waitlist", value: "keep" }] : [
            { label: "Keep existing places", value: "keep" },
            { label: "Unenrol and enrol", value: "withdraw" },
          ],
        },
      };
    }
    if (!full && decision?.choice === "withdraw") {
      for (const previous of existing) {
        await tx.enrolment.update({ where: { id: previous.id }, data: { status: "WITHDRAWN", endedOn: parseDateOnly(today()), scheduledEndOn: null } });
        await logAudit({
          actorId: session.user.id, actorName: session.user.name ?? "Unknown",
          action: "withdraw", entity: "Enrolment", entityId: previous.id, programmeId: previous.programmeId, clubId,
          summary: `Withdrew ${fullName(student)} from ${courseLabel(previous.course)} when enrolling in ${courseLabel(course)}`,
        }, tx);
      }
    }
    const enrolment = await tx.enrolment.create({
      data: {
        studentId, courseId, levelId: course.levelId, programmeId: course.level.programmeId,
        status: full ? "WAITLISTED" : "ACTIVE", startedOn: parseDateOnly(today()),
        placementReason: earned ? null : placementReason,
      }, select: { id: true },
    });
    await logAudit({
      actorId: session.user.id, actorName: session.user.name ?? "Unknown",
      action: full ? "waitlist" : "enrol", entity: "Enrolment", entityId: enrolment.id,
      programmeId: course.level.programmeId, clubId,
      summary: `${full ? "Waitlisted" : "Enrolled"} ${fullName(student)} in ${courseLabel(course)} at ${course.level.name}` +
        (earned ? "" : ` — placed out of sequence: ${placementReason}`),
    }, tx);
    return ok();
  });
  if (result.ok) revalidate();
  return result;
}

const endSchema = z.object({
  status: z.enum(["WITHDRAWN", "COMPLETED"]),
  note: z.string().trim().max(300, "Keep the note under 300 characters."),
});

export async function endEnrolment(id: string, input: z.infer<typeof endSchema>): Promise<ActionResult> {
  const session = await requirePermission("enrolment.manage");
  const parsed = endSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const clubId = await currentClubId();
  const source = await prisma.enrolment.findUnique({
    where: { id, course: { clubId }, student: { clubId } }, select: { courseId: true },
  });
  if (!source) return fail("That enrolment is not available in this club.");
  const result = await withCourseSeat(source.courseId, async (tx) => {
    const enrolment = await tx.enrolment.findUnique({ where: { id }, select: ENROLMENT_SELECT });
    if (!enrolment) return fail("That enrolment no longer exists.");
    if (enrolment.status !== "ACTIVE" && enrolment.status !== "WAITLISTED") return fail("That enrolment has already ended.");
    if (enrolment.status === "WAITLISTED" && parsed.data.status === "COMPLETED") return fail("A waitlisted swimmer has not taken this class. Withdraw the booking instead.");
    await tx.enrolment.update({ where: { id }, data: { status: parsed.data.status, endedOn: parseDateOnly(today()), scheduledEndOn: null } });
    await logAudit({
      actorId: session.user.id, actorName: session.user.name ?? "Unknown",
      action: parsed.data.status === "COMPLETED" ? "complete" : "withdraw",
      entity: "Enrolment", entityId: id, programmeId: enrolment.programmeId, clubId,
      summary: `${parsed.data.status === "COMPLETED" ? "Finished" : "Withdrew"} ${fullName(enrolment.student)} from ${courseLabel(enrolment.course)}` +
        (parsed.data.note ? ` — ${parsed.data.note}` : ""),
    }, tx);
    return ok();
  });
  if (result.ok) revalidate();
  return result;
}

export async function promoteFromWaitlist(id: string): Promise<ActionResult> {
  const session = await requirePermission("enrolment.manage");
  const clubId = await currentClubId();
  const source = await prisma.enrolment.findUnique({
    where: { id, course: { clubId }, student: { clubId } }, select: { courseId: true, studentId: true },
  });
  if (!source) return fail("That enrolment is not available in this club.");
  const result = await withCourseSeat(source.courseId, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${source.studentId} FOR UPDATE`;
    const enrolment = await tx.enrolment.findUnique({ where: { id }, select: ENROLMENT_SELECT });
    if (!enrolment) return fail("That enrolment no longer exists.");
    if (enrolment.status !== "WAITLISTED") return fail("They are not on the waitlist.");
    if (enrolment.student.status !== "ACTIVE") return fail(`${fullName(enrolment.student)} is marked inactive.`);
    if (enrolment.course.archivedAt) return fail("That class is archived.");
    if (enrolment.course.level.archivedAt || enrolment.course.level.programme.archivedAt) return fail("That class's level or programme is archived. Restore it first.");
    const taken = await tx.enrolment.count({ where: { courseId: enrolment.courseId, status: "ACTIVE" } });
    if (enrolment.course.capacity !== null && taken >= enrolment.course.capacity) return fail(
      `${courseLabel(enrolment.course)} is still full (${capacityLabel(taken, enrolment.course.capacity)}).`
    );
    await tx.enrolment.update({ where: { id }, data: { status: "ACTIVE", startedOn: parseDateOnly(today()) } });
    await logAudit({
      actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: "enrol",
      entity: "Enrolment", entityId: id, programmeId: enrolment.programmeId, clubId,
      summary: `Moved ${fullName(enrolment.student)} off the waitlist into ${courseLabel(enrolment.course)}`,
    }, tx);
    return ok();
  });
  if (result.ok) revalidate();
  return result;
}

/** Close the original place and create a new history row. Both class locks
 *  prevent concurrent transfers from moving one enrolment twice. */
export async function transferEnrolment(id: string, toCourseId: string, placementReason = "", confirmation?: ConfirmationReply): Promise<ActionResult> {
  const session = await requirePermission("enrolment.manage");
  const parsed = z.object({
    toCourseId: z.string().min(1, "Pick a class."), placementReason: placementReasonSchema,
  }).safeParse({ toCourseId, placementReason });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const reply = z.object({ choice: z.literal("move"), ids: z.tuple([z.string(), z.string()]) }).optional().safeParse(confirmation);
  if (!reply.success) return fail("Confirm the move before continuing.");
  const clubId = await currentClubId();
  const source = await prisma.enrolment.findUnique({
    where: { id, course: { clubId }, student: { clubId } }, select: { courseId: true, studentId: true },
  });
  if (!source) return fail("That enrolment is not available in this club.");
  if (source.courseId === toCourseId) return fail("That is the same class.");
  const result = await withCourseSeat([source.courseId, toCourseId], async (tx): Promise<ActionResult> => {
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${source.studentId} FOR UPDATE`;
    const from = await tx.enrolment.findUnique({ where: { id }, select: ENROLMENT_SELECT });
    if (!from) return fail("That enrolment no longer exists.");
    if (from.status !== "ACTIVE" && from.status !== "WAITLISTED") return fail("That enrolment has already ended.");
    if (from.student.status !== "ACTIVE") return fail(`${fullName(from.student)} is marked inactive.`);
    const to = await tx.course.findUnique({ where: { id: toCourseId, clubId }, select: COURSE_SELECT });
    if (!to) return fail("That class is not available in this club.");
    if (to.archivedAt) return fail("That class is archived.");
    if (to.level.archivedAt || to.level.programme.archivedAt) return fail("That class's level or programme is archived. Restore it first.");
    const open = await tx.enrolment.findFirst({
      where: { studentId: from.studentId, courseId: toCourseId, status: { in: ["ACTIVE", "WAITLISTED"] } },
      select: { id: true },
    });
    if (open) return fail(`${fullName(from.student)} is already in that class or on its waitlist.`);
    const { earned } = await placementFor(tx, from.studentId, to);
    // A waitlisted swimmer moving sideways keeps the original placement reason.
    const reason = parsed.data.placementReason || (from.course.levelId === to.levelId ? from.placementReason : null);
    if (!earned && !reason) return fail(`Say why ${fullName(from.student)} is being placed at ${to.level.name}; they have not earned that level yet.`);
    const taken = await tx.enrolment.count({ where: { courseId: toCourseId, status: "ACTIVE" } });
    if (to.capacity !== null && taken >= to.capacity) return fail(`${courseLabel(to)} is full (${capacityLabel(taken, to.capacity)}).`);
    if (reply.data?.ids[0] !== id || reply.data.ids[1] !== toCourseId) {
      return {
        ok: false,
        error: "Confirm the move before continuing.",
        confirmation: {
          title: `Continue with moving ${fullName(from.student)}?`,
          description: `From ${from.status === "WAITLISTED" ? "the waitlist for " : ""}${courseLabel(from.course)} to ${courseLabel(to)}. Their current place will end and the new place will open. Attendance and marks stay on record.`,
          ids: [id, toCourseId],
          choices: [{ label: "Confirm move", value: "move" }],
        },
      };
    }
    const startedOn = parseDateOnly(today());
    // Leaving a waitlist is a withdrawn booking, not evidence that the swimmer
    // occupied the original class. Keep that distinction in future history.
    const sourceStatus = from.status === "WAITLISTED" ? "WITHDRAWN" : "TRANSFERRED";
    await tx.enrolment.update({ where: { id }, data: { status: sourceStatus, endedOn: startedOn, scheduledEndOn: null } });
    const created = await tx.enrolment.create({
      data: {
        studentId: from.studentId, courseId: toCourseId, levelId: to.levelId,
        programmeId: to.level.programmeId, status: "ACTIVE", startedOn,
        placementReason: earned ? null : reason,
      }, select: { id: true },
    });
    await logAudit({
      actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: "transfer",
      entity: "Enrolment", entityId: created.id, programmeId: to.level.programmeId, clubId,
      summary: `Moved ${fullName(from.student)} from ${from.status === "WAITLISTED" ? "the waitlist for " : ""}${courseLabel(from.course)} to ${courseLabel(to)}` +
        (earned ? "" : ` — placed out of sequence: ${reason}`),
    }, tx);
    return ok();
  });
  if (result.ok) revalidate();
  return result;
}
