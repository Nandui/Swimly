"use server";

import { isArchivedSite, sitesByIds } from "@/lib/directory";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { fail, ok, type ActionResult, type ConfirmationReply, type PlannedChange } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { capacityLabel, courseLabelWithSite as courseLabel, courseName } from "@/modules/activities/shared/courses/constants";
import { withCourseSeat } from "@/modules/activities/shared/enrolment/seat";
import { parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/modules/activities/shared/students/constants";
import { readSharedCurriculum, sharedCourse } from "@/modules/activities/shared/curriculum/data/shared";
import { prisma } from "@/lib/prisma";
import { assessedElsewhere, COURSE_SELECT, OTHER_SITE, placementFor } from "@/modules/activities/shared/enrolment/rules";
import { agreementRecord, LEGEND_AGREEMENT_META, type LegendAgreementChoice } from "@/modules/activities/shared/enrolment/legend-agreement";
import { isLeaveReason, LEAVE_REASONS } from "@/modules/activities/shared/enrolment/leave-reasons";
import { changePlace, levelNote } from "@/modules/activities/shared/enrolment/change";

/** Centre names for the confirmation's picture of the change. */
async function centreNamer(ids: string[], tx: Prisma.TransactionClient) {
  const sites = await sitesByIds(ids, tx);
  return (id: string) => sites.get(id)?.name ?? "Removed site";
}

const placementReasonSchema = z.string().trim().max(300, "Keep the reason under 300 characters.");
const enrolSchema = z.object({
  studentId: z.string().min(1, "Pick a swimmer."),
  courseId: z.string().min(1, "Pick a class."),
  placementReason: placementReasonSchema,
  allowWaitlist: z.boolean(),
  legendAgreement: z.enum(["PENDING", "DONE"]).optional(),
});
export type EnrolInput = z.infer<typeof enrolSchema>;

const ENROLMENT_SELECT = {
  id: true, status: true, studentId: true, courseId: true, programmeId: true,
  placementReason: true,
  legendAgreementStatus: true, legendAgreementUpdatedAt: true,
  legendAgreementUpdatedById: true, legendAgreementUpdatedByName: true,
  student: { select: { firstName: true, lastName: true, status: true, clubId: true } },
  course: { select: COURSE_SELECT },
} as const satisfies Prisma.EnrolmentSelect;

function revalidate() {
  revalidatePath("/legend-agreements");
  revalidatePath("/awaiting-enrolment");
  revalidatePath("/courses");
  revalidatePath("/courses/[id]", "page");
  revalidatePath("/students/[id]", "page");
  revalidatePath("/schedule");
  revalidatePath("/instructor");
  revalidatePath("/instructor/classes/[id]", "page");
  revalidatePath("/instructor/classes/[id]/overview", "page");
}

export async function enrolStudent(input: EnrolInput, confirmation?: ConfirmationReply): Promise<ActionResult> {
  const session = await requirePermission("enrolment.manage");
  const parsed = enrolSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { studentId, courseId, placementReason, allowWaitlist, legendAgreement } = parsed.data;
  const reply = z.object({ choice: z.enum(["keep", "withdraw"]), ids: z.array(z.string().min(1)).max(100) }).optional().safeParse(confirmation);
  if (!reply.success) return fail("Choose whether to keep the existing places or unenrol.");
  const existingWhere = { studentId, courseId: { not: courseId }, status: "ACTIVE" as const };
  // Lock the source classes in the same order as transfers, before the swimmer.
  const sources = await prisma.enrolment.findMany({ where: existingWhere, select: { courseId: true } });

  const result = await withCourseSeat([courseId, ...sources.map((row) => row.courseId)], async (tx): Promise<ActionResult> => {
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${studentId} FOR UPDATE`;
    const [student, rawCourse] = await Promise.all([
      tx.student.findUnique({
        where: { id: studentId },
        select: { id: true, firstName: true, lastName: true, status: true },
      }),
      tx.course.findUnique({ where: { id: courseId }, select: COURSE_SELECT }),
    ]);
    if (!student) return fail("That swimmer no longer exists.");
    if (student.status !== "ACTIVE") return fail(`${fullName(student)} is marked inactive.`);
    if (!rawCourse) return fail("That class no longer exists.");
    const course = sharedCourse(rawCourse, await readSharedCurriculum(tx));
    if (course.archivedAt || await isArchivedSite(course.clubId, tx)) return fail("That class or its site is archived.");
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
    if (!full && !legendAgreement) return fail("Confirm whether the billing agreement has been updated in Legend.", { legendAgreement: "Choose Updated in Legend or Still to do." });
    const existing = await tx.enrolment.findMany({
      where: existingWhere, select: { id: true, courseId: true, programmeId: true, course: { select: COURSE_SELECT } },
      orderBy: { id: "asc" },
    });
    const decision = reply.data;
    const elsewhere = await assessedElsewhere(tx, studentId, course);
    const siteKey = `${OTHER_SITE}${course.clubId}`;
    const placeIds = decision?.ids.filter((id) => !id.startsWith(OTHER_SITE)) ?? [];
    const matches = decision && placeIds.length === existing.length && existing.every((row) => placeIds.includes(row.id));
    const placesUnanswered = existing.length > 0 && (!matches || (full && decision?.choice === "withdraw") || existing.some((row) => !sources.some((source) => source.courseId === row.courseId)));
    const siteUnanswered = elsewhere !== null && !decision?.ids.includes(siteKey);
    // Every enrolment is confirmed first, on a picture of the change (owner request, 21 October 2026).
    let change: PlannedChange | undefined;
    if (placesUnanswered || siteUnanswered || !decision) {
      const centre = await centreNamer([course.clubId, ...existing.map((row) => row.course.clubId)], tx);
      change = {
        subject: fullName(student), kind: full ? "waitlist" : "enrol",
        from: existing.map((row) => changePlace(row.course, centre(row.course.clubId))),
        to: changePlace(course, centre(course.clubId)),
        notes: [
          ...(elsewhere ? [`Assessed at ${elsewhere.assessedAt}. Parents are told lessons are at the centre where their child was assessed, so check with the family.`] : []),
          ...(full ? ["The class is full, so they join its waitlist and do not hold a place yet."] : []),
          ...(earned ? [] : [`Placed above the level they have earned: ${placementReason}`]),
          ...(!full && legendAgreement ? [`Legend billing agreement: ${LEGEND_AGREEMENT_META[legendAgreement].label}.`] : []),
        ],
      };
    }
    if (placesUnanswered || siteUnanswered) {
      const siteWarning = elsewhere
        ? `${fullName(student)} was assessed at ${elsewhere.assessedAt}, and parents are told lessons are only at the centre where their child was assessed. This class is at ${elsewhere.classAt}. `
        : "";
      return {
        ok: false, error: existing.length ? "Choose what to do with the existing places." : `Check the centre: ${fullName(student)} was assessed at ${elsewhere?.assessedAt}.`,
        confirmation: existing.length ? {
          title: "Unenrol from the previous class?",
          description: siteWarning + `${fullName(student)} is already enrolled in: ${existing.map((row) => `${courseLabel(row.course)} (${row.course.level.name})`).join("; ")}. ` +
            (full ? "The new class is full. Joining its waitlist keeps these places." : "Keep these places, or end them when enrolling in the new class. Attendance and marks stay on record."),
          ids: [...existing.map((row) => row.id), ...(elsewhere ? [siteKey] : [])],
          choices: full ? [{ label: "Keep places and join waitlist", value: "keep" }] : [
            { label: "Keep existing places", value: "keep" },
            { label: "Unenrol and enrol", value: "withdraw" },
          ],
          change,
        } : {
          title: `Enrol at ${elsewhere?.classAt} instead of ${elsewhere?.assessedAt}?`,
          description: siteWarning + "Check with the family that they want lessons at this centre before you go ahead.",
          ids: [siteKey],
          choices: [{ label: full ? `Join the waitlist at ${elsewhere?.classAt}` : `Enrol at ${elsewhere?.classAt}`, value: "keep" }],
          change,
        },
      };
    }
    if (!decision) return {
      ok: false, error: "Check the enrolment before it is saved.",
      confirmation: {
        title: full ? `Put ${fullName(student)} on the waitlist?` : `Enrol ${fullName(student)}?`,
        description: full
          ? `${courseLabel(course)} is full (${capacityLabel(taken, course.capacity)}). They join its waitlist.`
          : "Their place starts today. Nothing changes until you confirm.",
        ids: [],
        choices: [{ label: full ? "Join the waitlist" : "Confirm enrolment", value: "keep" }],
        change,
      },
    };
    if (!full && decision?.choice === "withdraw") {
      for (const previous of existing) {
        await tx.enrolment.update({ where: { id: previous.id }, data: { status: "WITHDRAWN", endedOn: parseDateOnly(today()), scheduledEndOn: null } });
        await logAudit({
          actorId: session.user.id, actorName: session.user.name ?? "Unknown",
          action: "withdraw", entity: "Enrolment", entityId: previous.id, programmeId: previous.programmeId, clubId: previous.course.clubId,
          summary: `Withdrew ${fullName(student)} from ${courseLabel(previous.course)} when enrolling in ${courseLabel(course)}`,
        }, tx);
      }
    }
    const enrolment = await tx.enrolment.create({
      data: {
        studentId, courseId, levelId: course.levelId, programmeId: course.level.programmeId,
        status: full ? "WAITLISTED" : "ACTIVE", startedOn: parseDateOnly(today()),
        placementReason: earned ? null : placementReason,
        ...(!full && legendAgreement ? agreementRecord(legendAgreement, session.user) : {}),
      }, select: { id: true },
    });
    await logAudit({
      actorId: session.user.id, actorName: session.user.name ?? "Unknown",
      action: full ? "waitlist" : "enrol", entity: "Enrolment", entityId: enrolment.id,
      programmeId: course.level.programmeId, clubId: course.clubId,
      summary: `${full ? "Waitlisted" : "Enrolled"} ${fullName(student)} in ${courseLabel(course)} at ${course.level.name}` +
        (elsewhere ? ` — assessed at ${elsewhere.assessedAt}, enrolled at ${elsewhere.classAt} after a warning` : "") +
        (!full && legendAgreement ? ` — Legend agreement: ${LEGEND_AGREEMENT_META[legendAgreement].label}` : "") +
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
  /** Required to withdraw a swimmer from a place they hold (LEAVE_REASONS). */
  leaveReason: z.string().optional(),
});

export async function endEnrolment(id: string, input: z.infer<typeof endSchema>): Promise<ActionResult> {
  const session = await requirePermission("enrolment.manage");
  const parsed = endSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const source = await prisma.enrolment.findUnique({
    where: { id }, select: { courseId: true },
  });
  if (!source) return fail("That enrolment no longer exists.");
  const result = await withCourseSeat(source.courseId, async (tx) => {
    const enrolment = await tx.enrolment.findUnique({ where: { id }, select: ENROLMENT_SELECT });
    if (!enrolment) return fail("That enrolment no longer exists.");
    if (enrolment.status !== "ACTIVE" && enrolment.status !== "WAITLISTED") return fail("That enrolment has already ended.");
    if (enrolment.status === "WAITLISTED" && parsed.data.status === "COMPLETED") return fail("A waitlisted swimmer has not taken this class. Withdraw the booking instead.");
    const leaving = enrolment.status === "ACTIVE" && parsed.data.status === "WITHDRAWN";
    if (leaving && !isLeaveReason(parsed.data.leaveReason)) return fail("Choose why they are leaving.", { leaveReason: "Choose a reason." });
    const leaveReason = leaving && isLeaveReason(parsed.data.leaveReason) ? parsed.data.leaveReason : null;
    await tx.enrolment.update({ where: { id }, data: { status: parsed.data.status, endedOn: parseDateOnly(today()), scheduledEndOn: null, ...(leaveReason ? { leaveReason } : {}) } });
    await logAudit({
      actorId: session.user.id, actorName: session.user.name ?? "Unknown",
      action: parsed.data.status === "COMPLETED" ? "complete" : "withdraw",
      entity: "Enrolment", entityId: id, programmeId: enrolment.programmeId, clubId: enrolment.course.clubId,
      summary: `${parsed.data.status === "COMPLETED" ? "Finished" : "Withdrew"} ${fullName(enrolment.student)} from ${courseLabel(enrolment.course)}` +
        (leaveReason ? ` (${LEAVE_REASONS[leaveReason]})` : "") + (parsed.data.note ? ` — ${parsed.data.note}` : ""),
    }, tx);
    return ok();
  });
  if (result.ok) revalidate();
  return result;
}

export async function promoteFromWaitlist(id: string, legendAgreement?: LegendAgreementChoice, confirmation?: ConfirmationReply): Promise<ActionResult> {
  const session = await requirePermission("enrolment.manage");
  if (legendAgreement !== "PENDING" && legendAgreement !== "DONE") return fail("Confirm whether the billing agreement has been updated in Legend.", { legendAgreement: "Choose Updated in Legend or Still to do." });
  const source = await prisma.enrolment.findUnique({
    where: { id }, select: { courseId: true, studentId: true },
  });
  if (!source) return fail("That enrolment no longer exists.");
  const result = await withCourseSeat(source.courseId, async (tx): Promise<ActionResult> => {
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${source.studentId} FOR UPDATE`;
    const enrolment = await tx.enrolment.findUnique({ where: { id }, select: ENROLMENT_SELECT });
    if (!enrolment) return fail("That enrolment no longer exists.");
    if (enrolment.status !== "WAITLISTED") return fail("They are not on the waitlist.");
    if (enrolment.student.status !== "ACTIVE") return fail(`${fullName(enrolment.student)} is marked inactive.`);
    if (enrolment.course.archivedAt || await isArchivedSite(enrolment.course.clubId, tx)) return fail("That class or its site is archived.");
    const shared = sharedCourse(enrolment.course, await readSharedCurriculum(tx));
    if (shared.level.archivedAt || shared.level.programme.archivedAt) return fail("That class's level or programme is archived. Restore it first.");
    const taken = await tx.enrolment.count({ where: { courseId: enrolment.courseId, status: "ACTIVE" } });
    if (enrolment.course.capacity !== null && taken >= enrolment.course.capacity) return fail(
      `${courseLabel(enrolment.course)} is still full (${capacityLabel(taken, enrolment.course.capacity)}).`
    );
    if (confirmation?.choice !== "enrol" || confirmation.ids[0] !== id) {
      const centre = await centreNamer([shared.clubId], tx);
      return {
        ok: false, error: "Check the enrolment before it is saved.",
        confirmation: {
          title: `Enrol ${fullName(enrolment.student)} from the waitlist?`,
          description: "Their place starts today. Nothing changes until you confirm.",
          ids: [id],
          choices: [{ label: "Confirm enrolment", value: "enrol" }],
          change: {
            subject: fullName(enrolment.student), kind: "enrol", from: [],
            to: changePlace(shared, centre(shared.clubId)),
            notes: ["They leave the waitlist and take a place in the class.", `Legend billing agreement: ${LEGEND_AGREEMENT_META[legendAgreement].label}.`],
          },
        },
      };
    }
    await tx.enrolment.update({ where: { id }, data: { status: "ACTIVE", startedOn: parseDateOnly(today()), ...agreementRecord(legendAgreement, session.user) } });
    await logAudit({
      actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: "enrol",
      entity: "Enrolment", entityId: id, programmeId: enrolment.programmeId, clubId: enrolment.course.clubId,
      summary: `Moved ${fullName(enrolment.student)} off the waitlist into ${courseLabel(enrolment.course)} — Legend agreement: ${LEGEND_AGREEMENT_META[legendAgreement].label}`,
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
  const source = await prisma.enrolment.findUnique({
    where: { id }, select: { courseId: true, studentId: true },
  });
  if (!source) return fail("That enrolment no longer exists.");
  if (source.courseId === toCourseId) return fail("That is the same class.");
  const result = await withCourseSeat([source.courseId, toCourseId], async (tx): Promise<ActionResult> => {
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${source.studentId} FOR UPDATE`;
    const from = await tx.enrolment.findUnique({ where: { id }, select: ENROLMENT_SELECT });
    if (!from) return fail("That enrolment no longer exists.");
    if (from.status !== "ACTIVE" && from.status !== "WAITLISTED") return fail("That enrolment has already ended.");
    if (from.student.status !== "ACTIVE") return fail(`${fullName(from.student)} is marked inactive.`);
    const rawTo = await tx.course.findUnique({ where: { id: toCourseId }, select: COURSE_SELECT });
    if (!rawTo) return fail("That class no longer exists.");
    const curriculum = await readSharedCurriculum(tx);
    const to = sharedCourse(rawTo, curriculum);
    if (to.archivedAt || await isArchivedSite(to.clubId, tx)) return fail("That class or its site is archived.");
    if (to.level.archivedAt || to.level.programme.archivedAt) return fail("That class's level or programme is archived. Restore it first.");
    const open = await tx.enrolment.findFirst({
      where: { studentId: from.studentId, courseId: toCourseId, status: { in: ["ACTIVE", "WAITLISTED"] } },
      select: { id: true },
    });
    if (open) return fail(`${fullName(from.student)} is already in that class or on its waitlist.`);
    const { earned } = await placementFor(tx, from.studentId, to);
    // A waitlisted swimmer moving sideways keeps the original placement reason.
    const reason = parsed.data.placementReason || (curriculum.levelIds.resolve(from.course.levelId) === to.levelId ? from.placementReason : null);
    if (!earned && !reason) return fail(`Say why ${fullName(from.student)} is being placed at ${to.level.name}; they have not earned that level yet.`);
    const taken = await tx.enrolment.count({ where: { courseId: toCourseId, status: "ACTIVE" } });
    if (to.capacity !== null && taken >= to.capacity) return fail(`${courseLabel(to)} is full (${capacityLabel(taken, to.capacity)}).`);
    if (reply.data?.ids[0] !== id || reply.data.ids[1] !== toCourseId) {
      const left = sharedCourse(from.course, curriculum);
      const centre = await centreNamer([left.clubId, to.clubId], tx);
      const elsewhere = await assessedElsewhere(tx, from.studentId, to);
      const waiting = from.status === "WAITLISTED";
      return {
        ok: false,
        error: "Confirm the move before continuing.",
        confirmation: {
          title: `Continue with moving ${fullName(from.student)}?`,
          description: "Check the change below. Their current place ends today and the new place starts today.",
          ids: [id, toCourseId],
          choices: [{ label: "Confirm move", value: "move" }],
          change: {
            subject: fullName(from.student), kind: "move",
            from: [{ ...changePlace(left, centre(left.clubId)), ...(waiting ? { title: `Waitlist for ${courseName(left)}` } : {}) }],
            to: changePlace(to, centre(to.clubId)),
            notes: [
              ...levelNote(left.level.name, to.level.name),
              ...(elsewhere ? [`Assessed at ${elsewhere.assessedAt}. Parents are told lessons are at the centre where their child was assessed, so check with the family.`] : []),
              ...(earned ? [] : [`Placed above the level they have earned: ${reason}`]),
              "Their attendance and marks so far stay on their record.",
            ],
          },
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
        legendAgreementStatus: from.legendAgreementStatus,
        legendAgreementUpdatedAt: from.legendAgreementUpdatedAt,
        legendAgreementUpdatedById: from.legendAgreementUpdatedById,
        legendAgreementUpdatedByName: from.legendAgreementUpdatedByName,
      }, select: { id: true },
    });
    await logAudit({
      actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: "transfer",
      entity: "Enrolment", entityId: created.id, programmeId: to.level.programmeId, clubId: to.clubId,
      summary: `Moved ${fullName(from.student)} from ${from.status === "WAITLISTED" ? "the waitlist for " : ""}${courseLabel(from.course)} to ${courseLabel(to)}` +
        (earned ? "" : ` — placed out of sequence: ${reason}`),
    }, tx);
    if (from.course.clubId !== to.clubId) {
      await logAudit({
        actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: "transfer-out",
        entity: "Enrolment", entityId: id, programmeId: from.programmeId, clubId: from.course.clubId,
        summary: `Moved ${fullName(from.student)} from ${courseLabel(from.course)} to ${courseLabel(to)}`,
      }, tx);
    }
    return ok();
  });
  if (result.ok) revalidate();
  return result;
}
