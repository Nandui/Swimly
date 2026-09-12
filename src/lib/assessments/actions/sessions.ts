"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { sessionLabel } from "@/lib/assessments/constants";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { withAssessmentSeat } from "@/lib/assessments/seat";
import { parseTime } from "@/lib/courses/constants";
import { isDateOnly, parseDateOnly } from "@/lib/format";
import { readSharedCurriculum } from "@/lib/curriculum/data/shared";
import { prisma } from "@/lib/prisma";

/** Sessions are timetable, so they share the timetable's permission. */

const sessionSchema = z.object({
  programmeId: z.string().min(1, "Pick the programme this session assesses for."),
  typeId: z.string().min(1, "Pick the kind of assessment."),
  date: z.string().refine(isDateOnly, "Give a valid assessment date."),
  start: z
    .string()
    .trim()
    .refine((value) => parseTime(value) !== null, "Give the start as a 24-hour time, like 13:30."),
  durationMinutes: z.coerce
    .number()
    .int("Whole minutes.")
    .min(5, "At least five minutes.")
    .max(240, "Four hours is the most this will accept."),
  capacity: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d+$/.test(value), "Capacity is a whole number.")
    .refine((value) => value === "" || Number(value) >= 1, "Capacity has to be at least one.")
    .refine((value) => value === "" || Number(value) <= 999, "Keep capacity under 1,000 places."),
  location: z.string().trim().max(120, "Keep the location under 120 characters."),
  instructorId: z.string().trim(),
  notes: z.string().trim().max(500, "Keep the notes under 500 characters."),
});

export type SessionInput = z.infer<typeof sessionSchema>;

function toData(input: SessionInput) {
  return {
    programmeId: input.programmeId,
    typeId: input.typeId,
    date: parseDateOnly(input.date),
    startMinutes: parseTime(input.start)!,
    durationMinutes: input.durationMinutes,
    capacity: input.capacity === "" ? null : Number(input.capacity),
    location: input.location || null,
    instructorId: input.instructorId || null,
    notes: input.notes || null,
  };
}

export async function createSession(input: SessionInput): Promise<ActionResult> {
  const session = await requirePermission("courses.manage");

  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = toData(parsed.data);
  const clubId = await currentClubId();

  const curriculum = await readSharedCurriculum();
  const programme = curriculum.programme(data.programmeId);
  if (!programme || programme.archivedAt) return fail("That programme is not available.");

  const kind = curriculum.types.find(t => t.id === curriculum.typeIds.resolve(data.typeId) && t.programmeId === programme.id && !t.archivedAt);
  if (!kind) return fail(`That kind of assessment does not belong to ${programme.name}.`);
  if (data.instructorId && !await prisma.user.findUnique({ where: { id: data.instructorId, isActive: true }, select: { id: true } })) {
    return fail("That instructor is not available. Pick an active staff member.");
  }

  await prisma.$transaction(async (tx) => {
    const created = await tx.assessmentSession.create({
      // Assessments happen at the working site against the shared ladder.
      data: { ...data, programmeId: programme.id, typeId: kind.id, clubId },
      select: { id: true, date: true, startMinutes: true },
    });

    await logAudit({
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: "create",
      entity: "AssessmentSession",
      entityId: created.id,
      programmeId: programme.id,
      clubId,
      summary: `Added a ${kind.name} assessment session for ${programme.name} on ${sessionLabel(created)}${data.capacity ? ` with ${data.capacity} places` : ""
        }`,
    }, tx);
  });

  revalidatePath("/assessments");
  revalidatePath("/today");
  return ok();
}

export async function updateSession(id: string, input: SessionInput): Promise<ActionResult> {
  const session = await requirePermission("courses.manage");

  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = toData(parsed.data);
  const clubId = await currentClubId();

  const result = await withAssessmentSeat(id, async (tx) => {
    const existing = await tx.assessmentSession.findUnique({
      where: { id, clubId },
      select: {
        id: true,
        date: true,
        startMinutes: true,
        capacity: true,
        durationMinutes: true,
        location: true,
        instructorId: true,
        notes: true,
        clubId: true,
        programmeId: true,
        typeId: true,
        cancelledAt: true,
        _count: { select: { bookings: { where: { outcomeLevelId: { not: null } } } } },
      },
    });
    if (!existing) return fail("That session no longer exists.");
    if (existing.cancelledAt) return fail("That session was cancelled.");

    const curriculum = await readSharedCurriculum(tx);
    data.programmeId = curriculum.programmeIds.resolve(data.programmeId);
    data.typeId = curriculum.typeIds.resolve(data.typeId);
    existing.programmeId = curriculum.programmeIds.resolve(existing.programmeId);
    existing.typeId = existing.typeId ? curriculum.typeIds.resolve(existing.typeId) : existing.typeId;

    // An outcome names a level of the session's programme. Once one exists the
    // programme is load-bearing, and changing it would orphan the placement.
    if (existing._count.bookings > 0 && data.programmeId !== existing.programmeId) {
      return fail(
        "Outcomes have been recorded against this session, so its programme cannot change. Add a new session instead."
      );
    }

    if (data.programmeId !== existing.programmeId) {
      const programme = curriculum.programme(data.programmeId);
      if (!programme || programme.archivedAt) return fail("That programme is not available.");
    }
    if (data.typeId !== existing.typeId || data.programmeId !== existing.programmeId) {
      const kind = curriculum.types.find(t => t.id === data.typeId && t.programmeId === data.programmeId && !t.archivedAt);
      if (!kind) return fail("That kind of assessment does not belong to this programme.");
    }
    if (data.instructorId && data.instructorId !== existing.instructorId && !await tx.user.findUnique({ where: { id: data.instructorId, isActive: true }, select: { id: true } })) {
      return fail("That instructor is not available. Pick an active staff member.");
    }

    const changes: string[] = [];
    if (data.programmeId !== existing.programmeId) changes.push("programme");
    if (data.typeId !== existing.typeId) changes.push("kind of assessment");
    if (data.durationMinutes !== existing.durationMinutes) changes.push(`duration ${existing.durationMinutes} → ${data.durationMinutes} min`);
    if (data.location !== existing.location) changes.push(`location ${existing.location ?? "not set"} → ${data.location ?? "not set"}`);
    if (data.instructorId !== existing.instructorId) changes.push("instructor");
    if (data.notes !== existing.notes) changes.push("notes");

    const moved =
      existing.date.getTime() !== data.date.getTime() || existing.startMinutes !== data.startMinutes;
    if (!moved && changes.length === 0 && existing.capacity === data.capacity) return ok();

    await tx.assessmentSession.update({ where: { id }, data });

    await logAudit({
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: "update",
      entity: "AssessmentSession",
      entityId: id,
      programmeId: data.programmeId,
      clubId,
      summary:
        `Updated the assessment session on ${sessionLabel(data)}` +
        (moved ? ` (was ${sessionLabel(existing)})` : "") +
        (existing.capacity !== data.capacity
          ? ` — capacity ${existing.capacity ?? "uncapped"} → ${data.capacity ?? "uncapped"}`
          : "") +
        (changes.length ? ` (${changes.join(", ")})` : ""),
    }, tx);
    return ok();
  });
  if (!result.ok) return result;

  revalidatePath("/assessments");
  revalidatePath("/today");
  revalidatePath("/assessments/[id]", "page");
  return ok();
}

/** Cancelling a session lets its bookings go — the ones still merely booked.
 *  A child who was assessed and placed keeps that; it happened. */
export async function cancelSession(id: string): Promise<ActionResult> {
  const session = await requirePermission("courses.manage");
  const clubId = await currentClubId();

  const result = await withAssessmentSeat(id, async (tx) => {
    const existing = await tx.assessmentSession.findUnique({
      where: { id, clubId },
      select: {
        id: true,
        date: true,
        startMinutes: true,
        programmeId: true,
        cancelledAt: true,
        _count: { select: { bookings: { where: { status: "BOOKED" } } } },
      },
    });
    if (!existing) return fail("That session no longer exists.");
    if (existing.cancelledAt) return ok();

    await tx.assessmentSession.update({ where: { id }, data: { cancelledAt: new Date() } });
    await tx.assessmentBooking.updateMany({
      where: { sessionId: id, status: "BOOKED" }, data: { status: "CANCELLED" },
    });

    await logAudit({
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: "archive",
      entity: "AssessmentSession",
      entityId: id,
      programmeId: existing.programmeId,
      clubId,
      summary:
        `Cancelled the assessment session on ${sessionLabel(existing)}` +
        (existing._count.bookings
          ? ` and the ${existing._count.bookings} ${existing._count.bookings === 1 ? "booking" : "bookings"} on it`
          : ""),
    }, tx);
    return ok();
  });
  if (!result.ok) return result;

  revalidatePath("/assessments");
  revalidatePath("/today");
  revalidatePath("/assessments/[id]", "page");
  return ok();
}
