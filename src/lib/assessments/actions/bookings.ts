"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { Session } from "next-auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { HOLDS_A_PLACE, sessionLabel } from "@/lib/assessments/constants";
import { withAssessmentSeat } from "@/lib/assessments/seat";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

function revalidate() {
  revalidatePath("/reception");
  revalidatePath("/assessments");
  revalidatePath("/assessments/[id]", "page");
  revalidatePath("/students/[id]", "page");
  revalidatePath("/today");
}

const bookSchema = z.object({
  sessionId: z.string().min(1, "Pick a session."),
  studentId: z.string().min(1, "Pick a swimmer."),
});
export type BookInput = z.infer<typeof bookSchema>;

export async function bookStudent(input: BookInput): Promise<ActionResult> {
  const actor = await requirePermission("enrolment.manage");
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { sessionId, studentId } = parsed.data;
  const clubId = await currentClubId();

  const result = await withAssessmentSeat(sessionId, async (tx) => {
    const [student, session] = await Promise.all([
      tx.student.findUnique({
        where: { id: studentId, clubId },
        select: { id: true, firstName: true, lastName: true, status: true },
      }),
      tx.assessmentSession.findUnique({
        where: { id: sessionId, clubId },
        select: { id: true, date: true, startMinutes: true, capacity: true, cancelledAt: true, programmeId: true },
      }),
    ]);
    if (!student) return fail("That swimmer is not available in this club.");
    if (student.status !== "ACTIVE") return fail(`${fullName(student)} is marked inactive.`);
    if (!session) return fail("That session is not available in this club.");
    if (session.cancelledAt) return fail("That session was cancelled.");

    const existing = await tx.assessmentBooking.findUnique({
      where: { sessionId_studentId: { sessionId, studentId } }, select: { id: true, status: true },
    });
    if (existing && HOLDS_A_PLACE.includes(existing.status)) return fail(`${fullName(student)} is already booked on that session.`);
    const taken = await tx.assessmentBooking.count({ where: { sessionId, status: { in: HOLDS_A_PLACE } } });
    if (session.capacity !== null && taken >= session.capacity) return fail(
      `That session is full (${taken} of ${session.capacity}). Pick another, or add places to it.`
    );
    const attribution = { status: "BOOKED" as const, bookedById: actor.user.id, bookedByName: actor.user.name ?? "Unknown" };
    // A cancelled/no-show booking is restored in place: one row per swimmer.
    const booking = existing
      ? await tx.assessmentBooking.update({ where: { id: existing.id }, data: attribution, select: { id: true } })
      : await tx.assessmentBooking.create({ data: { sessionId, studentId, ...attribution }, select: { id: true } });
    await logAudit({
      actorId: actor.user.id, actorName: actor.user.name ?? "Unknown", action: "book",
      entity: "AssessmentBooking", entityId: booking.id, programmeId: session.programmeId, clubId,
      summary: `Booked ${fullName(student)} onto the assessment on ${sessionLabel(session)}`,
    }, tx);
    return ok();
  });
  if (result.ok) revalidate();
  return result;
}

const BOOKING_SELECT = {
  id: true, status: true, studentId: true, outcomeLevelId: true, outcomeNote: true,
  outcomeLevel: { select: { name: true } },
  student: { select: { firstName: true, lastName: true } },
  session: { select: { id: true, date: true, startMinutes: true, programmeId: true, cancelledAt: true } },
} as const satisfies Prisma.AssessmentBookingSelect;

type Booking = Prisma.AssessmentBookingGetPayload<{ select: typeof BOOKING_SELECT }>;

/** Session edits, cancellation and all booking transitions take the same row
 *  lock; a stale request cannot undo a cancellation or overwrite a placement. */
async function withBooking(
  id: string,
  run: (tx: Prisma.TransactionClient, booking: Booking, clubId: string) => Promise<ActionResult>
): Promise<ActionResult> {
  const clubId = await currentClubId();
  const source = await prisma.assessmentBooking.findUnique({
    where: { id, session: { clubId }, student: { clubId } }, select: { sessionId: true },
  });
  if (!source) return fail("That booking is not available in this club.");
  const result = await withAssessmentSeat(source.sessionId, async (tx) => {
    const booking = await tx.assessmentBooking.findUnique({ where: { id }, select: BOOKING_SELECT });
    if (!booking) return fail("That booking no longer exists.");
    return run(tx, booking, clubId);
  });
  if (result.ok) revalidate();
  return result;
}

async function changeUnusedBooking(id: string, actor: Session, status: "CANCELLED" | "NO_SHOW") {
  return withBooking(id, async (tx, booking, clubId) => {
    if (booking.status !== "BOOKED") return fail("Only a booking that has not yet been used can be changed.");
    if (status === "NO_SHOW" && booking.session.cancelledAt) return fail("That session was cancelled.");
    if (status === "NO_SHOW" && booking.session.date > parseDateOnly(today())) return fail("That assessment has not happened yet.");
    await tx.assessmentBooking.update({ where: { id }, data: { status } });
    await logAudit({
      actorId: actor.user.id, actorName: actor.user.name ?? "Unknown",
      action: status === "CANCELLED" ? "cancel-booking" : "no-show",
      entity: "AssessmentBooking", entityId: id, programmeId: booking.session.programmeId, clubId,
      summary: status === "CANCELLED"
        ? `Cancelled ${fullName(booking.student)}'s booking for the assessment on ${sessionLabel(booking.session)}`
        : `${fullName(booking.student)} did not come to the assessment on ${sessionLabel(booking.session)}`,
    }, tx);
    return ok();
  });
}

export async function cancelBooking(id: string): Promise<ActionResult> {
  const actor = await requirePermission("enrolment.manage");
  return changeUnusedBooking(id, actor, "CANCELLED");
}

export async function markNoShow(id: string): Promise<ActionResult> {
  const actor = await requirePermission("assessments.run");
  return changeUnusedBooking(id, actor, "NO_SHOW");
}

const outcomeSchema = z.object({
  bookingId: z.string().min(1, "Pick a booking."),
  levelId: z.string().min(1, "Pick the level they belong at."),
  note: z.string().trim().max(300, "Keep the note under 300 characters."),
});
export type OutcomeInput = z.infer<typeof outcomeSchema>;

export async function recordOutcome(input: OutcomeInput): Promise<ActionResult> {
  const actor = await requirePermission("assessments.run");
  const parsed = outcomeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { bookingId, levelId, note } = parsed.data;
  return withBooking(bookingId, async (tx, booking, clubId) => {
    if (booking.status === "CANCELLED") return fail("That booking was cancelled.");
    if (booking.session.cancelledAt) return fail("That session was cancelled.");
    if (booking.session.date > parseDateOnly(today())) return fail("That assessment has not happened yet.");
    // The outcome names a rung of this session's own programme.
    const level = await tx.level.findFirst({
      where: { id: levelId, programmeId: booking.session.programmeId, archivedAt: null },
      select: { id: true, name: true },
    });
    if (!level) return fail("That level is not part of the programme this session assesses for.");
    if (booking.status === "ATTENDED" && booking.outcomeLevelId === levelId && (booking.outcomeNote ?? "") === note) return ok();
    await tx.assessmentBooking.update({
      where: { id: bookingId },
      data: {
        status: "ATTENDED", outcomeLevelId: level.id, outcomeNote: note || null,
        assessedById: actor.user.id, assessedByName: actor.user.name ?? "Unknown", assessedOn: parseDateOnly(today()),
      },
    });
    await logAudit({
      actorId: actor.user.id, actorName: actor.user.name ?? "Unknown", action: "placed",
      entity: "AssessmentBooking", entityId: bookingId, programmeId: booking.session.programmeId, clubId,
      summary: `Placed ${fullName(booking.student)} at ${level.name} after the assessment on ${sessionLabel(booking.session)}` +
        (booking.outcomeLevel && booking.outcomeLevel.name !== level.name ? ` (was ${booking.outcomeLevel.name})` : "") +
        (note ? ` — ${note}` : ""),
    }, tx);
    return ok();
  });
}
