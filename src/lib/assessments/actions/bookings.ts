"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { HOLDS_A_PLACE, sessionLabel } from "@/lib/assessments/constants";
import { withAssessmentSeat } from "@/lib/assessments/seat";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** Booking a child onto a session is the front desk's job and shares the
 *  enrolment permission. Saying what happened in the water — who came, and
 *  where they belong — is the assessor's, and shares the assessing one. */

function revalidate(studentId?: string) {
  revalidatePath("/assessments");
  revalidatePath("/assessments/[id]", "page");
  if (studentId) revalidatePath("/students/[id]", "page");
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

  const [student, session] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, firstName: true, lastName: true, status: true },
    }),
    prisma.assessmentSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        date: true,
        startMinutes: true,
        capacity: true,
        cancelledAt: true,
        programmeId: true,
      },
    }),
  ]);

  if (!student) return fail("That swimmer no longer exists.");
  if (student.status !== "ACTIVE") return fail(`${fullName(student)} is marked inactive.`);
  if (!session) return fail("That session no longer exists.");
  if (session.cancelledAt) return fail("That session was cancelled.");

  const outcome = await withAssessmentSeat(sessionId, async (tx) => {
    const existing = await tx.assessmentBooking.findUnique({
      where: { sessionId_studentId: { sessionId, studentId } },
      select: { id: true, status: true },
    });
    if (existing && HOLDS_A_PLACE.includes(existing.status)) return { kind: "duplicate" } as const;

    const taken = await tx.assessmentBooking.count({
      where: { sessionId, status: { in: HOLDS_A_PLACE } },
    });
    if (session.capacity !== null && taken >= session.capacity) {
      return { kind: "full", taken } as const;
    }

    // A cancelled or no-show row is re-booked in place: one row per child per
    // session, whatever happened before.
    if (existing) {
      await tx.assessmentBooking.update({
        where: { id: existing.id },
        data: {
          status: "BOOKED",
          bookedById: actor.user.id,
          bookedByName: actor.user.name ?? "Unknown",
        },
      });
      return { kind: "rebooked" } as const;
    }

    await tx.assessmentBooking.create({
      data: {
        sessionId,
        studentId,
        status: "BOOKED",
        bookedById: actor.user.id,
        bookedByName: actor.user.name ?? "Unknown",
      },
    });
    return { kind: "booked" } as const;
  });

  if (outcome.kind === "duplicate") return fail(`${fullName(student)} is already booked on that session.`);
  if (outcome.kind === "full") {
    return fail(
      `That session is full (${outcome.taken} of ${session.capacity}). Pick another, or add places to it.`
    );
  }

  await logAudit({
    actorId: actor.user.id,
    actorName: actor.user.name ?? "Unknown",
    action: "book",
    entity: "AssessmentBooking",
    entityId: sessionId,
    programmeId: session.programmeId,
    summary: `Booked ${fullName(student)} onto the assessment on ${sessionLabel(session)}`,
  });

  revalidate(studentId);
  return ok();
}

async function loadBooking(id: string) {
  return prisma.assessmentBooking.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      studentId: true,
      student: { select: { firstName: true, lastName: true } },
      session: {
        select: { id: true, date: true, startMinutes: true, programmeId: true, cancelledAt: true },
      },
    },
  });
}

export async function cancelBooking(id: string): Promise<ActionResult> {
  const actor = await requirePermission("enrolment.manage");

  const booking = await loadBooking(id);
  if (!booking) return fail("That booking no longer exists.");
  if (booking.status !== "BOOKED") {
    return fail("Only a booking that has not yet been used can be cancelled.");
  }

  await prisma.assessmentBooking.update({ where: { id }, data: { status: "CANCELLED" } });

  await logAudit({
    actorId: actor.user.id,
    actorName: actor.user.name ?? "Unknown",
    action: "cancel-booking",
    entity: "AssessmentBooking",
    entityId: booking.session.id,
    programmeId: booking.session.programmeId,
    summary: `Cancelled ${fullName(booking.student)}'s booking for the assessment on ${sessionLabel(booking.session)}`,
  });

  revalidate(booking.studentId);
  return ok();
}

export async function markNoShow(id: string): Promise<ActionResult> {
  const actor = await requirePermission("progression.assess");

  const booking = await loadBooking(id);
  if (!booking) return fail("That booking no longer exists.");
  if (booking.status !== "BOOKED") return fail("Only a booked swimmer can be marked as not having come.");

  await prisma.assessmentBooking.update({ where: { id }, data: { status: "NO_SHOW" } });

  await logAudit({
    actorId: actor.user.id,
    actorName: actor.user.name ?? "Unknown",
    action: "no-show",
    entity: "AssessmentBooking",
    entityId: booking.session.id,
    programmeId: booking.session.programmeId,
    summary: `${fullName(booking.student)} did not come to the assessment on ${sessionLabel(booking.session)}`,
  });

  revalidate(booking.studentId);
  return ok();
}

const outcomeSchema = z.object({
  bookingId: z.string().min(1),
  levelId: z.string().min(1, "Pick the level they belong at."),
  note: z.string().trim().max(300, "Keep the note under 300 characters."),
});

export type OutcomeInput = z.infer<typeof outcomeSchema>;

/** The point of the whole thing: the assessor says where the child belongs.
 *  From then on `hasEarnedPlace` treats that level, and everything below it
 *  in the programme, as earned. */
export async function recordOutcome(input: OutcomeInput): Promise<ActionResult> {
  const actor = await requirePermission("progression.assess");

  const parsed = outcomeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { bookingId, levelId, note } = parsed.data;

  const booking = await loadBooking(bookingId);
  if (!booking) return fail("That booking no longer exists.");
  if (booking.status === "CANCELLED") return fail("That booking was cancelled.");

  // The outcome has to be a level of the programme the session assesses for.
  // Anything else would be a placement into a ladder nobody was watching.
  const level = await prisma.level.findFirst({
    where: { id: levelId, programmeId: booking.session.programmeId, archivedAt: null },
    select: { id: true, name: true },
  });
  if (!level) return fail("That level is not part of the programme this session assesses for.");

  const previous = await prisma.assessmentBooking.findUnique({
    where: { id: bookingId },
    select: { outcomeLevel: { select: { name: true } } },
  });

  await prisma.assessmentBooking.update({
    where: { id: bookingId },
    data: {
      status: "ATTENDED",
      outcomeLevelId: level.id,
      outcomeNote: note || null,
      assessedById: actor.user.id,
      assessedByName: actor.user.name ?? "Unknown",
      assessedOn: parseDateOnly(today()),
    },
  });

  await logAudit({
    actorId: actor.user.id,
    actorName: actor.user.name ?? "Unknown",
    action: "placed",
    entity: "AssessmentBooking",
    entityId: booking.session.id,
    programmeId: booking.session.programmeId,
    summary:
      `Placed ${fullName(booking.student)} at ${level.name} after the assessment on ${sessionLabel(booking.session)}` +
      (previous?.outcomeLevel && previous.outcomeLevel.name !== level.name
        ? ` (was ${previous.outcomeLevel.name})`
        : "") +
      (note ? ` — ${note}` : ""),
  });

  revalidate(booking.studentId);
  return ok();
}
