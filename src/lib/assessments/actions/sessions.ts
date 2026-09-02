"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { sessionLabel } from "@/lib/assessments/constants";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { parseTime } from "@/lib/courses/constants";
import { parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** Sessions are timetable, so they share the timetable's permission. */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const sessionSchema = z.object({
  programmeId: z.string().min(1, "Pick the programme this session assesses for."),
  date: z.string().regex(ISO_DATE, "Give the date as a date."),
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
    .refine((value) => value === "" || Number(value) >= 1, "Capacity has to be at least one."),
  location: z.string().trim().max(120, "Keep the location under 120 characters."),
  instructorId: z.string().trim(),
  notes: z.string().trim().max(500, "Keep the notes under 500 characters."),
});

export type SessionInput = z.infer<typeof sessionSchema>;

function toData(input: SessionInput) {
  return {
    programmeId: input.programmeId,
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

  const programme = await prisma.programme.findUnique({
    where: { id: data.programmeId },
    select: { id: true, name: true, archivedAt: true },
  });
  if (!programme || programme.archivedAt) return fail("That programme is not available.");

  const created = await prisma.assessmentSession.create({
    data,
    select: { id: true, date: true, startMinutes: true },
  });

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "create",
    entity: "AssessmentSession",
    entityId: created.id,
    programmeId: programme.id,
    summary: `Added an assessment session for ${programme.name} on ${sessionLabel(created)}${
      data.capacity ? ` with ${data.capacity} places` : ""
    }`,
  });

  revalidatePath("/assessments");
  return ok();
}

export async function updateSession(id: string, input: SessionInput): Promise<ActionResult> {
  const session = await requirePermission("courses.manage");

  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = toData(parsed.data);

  const existing = await prisma.assessmentSession.findUnique({
    where: { id },
    select: {
      id: true,
      date: true,
      startMinutes: true,
      capacity: true,
      programmeId: true,
      cancelledAt: true,
      _count: { select: { bookings: { where: { outcomeLevelId: { not: null } } } } },
    },
  });
  if (!existing) return fail("That session no longer exists.");
  if (existing.cancelledAt) return fail("That session was cancelled.");

  // An outcome names a level of the session's programme. Once one exists the
  // programme is load-bearing, and changing it would orphan the placement.
  if (existing._count.bookings > 0 && data.programmeId !== existing.programmeId) {
    return fail(
      "Outcomes have been recorded against this session, so its programme cannot change. Add a new session instead."
    );
  }

  await prisma.assessmentSession.update({ where: { id }, data });

  const moved =
    existing.date.getTime() !== data.date.getTime() || existing.startMinutes !== data.startMinutes;

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "update",
    entity: "AssessmentSession",
    entityId: id,
    programmeId: data.programmeId,
    summary:
      `Updated the assessment session on ${sessionLabel(data)}` +
      (moved ? ` (was ${sessionLabel(existing)})` : "") +
      (existing.capacity !== data.capacity
        ? ` — capacity ${existing.capacity ?? "uncapped"} → ${data.capacity ?? "uncapped"}`
        : ""),
  });

  revalidatePath("/assessments");
  revalidatePath("/assessments/[id]", "page");
  return ok();
}

/** Cancelling a session lets its bookings go — the ones still merely booked.
 *  A child who was assessed and placed keeps that; it happened. */
export async function cancelSession(id: string): Promise<ActionResult> {
  const session = await requirePermission("courses.manage");

  const existing = await prisma.assessmentSession.findUnique({
    where: { id },
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

  await prisma.$transaction([
    prisma.assessmentSession.update({ where: { id }, data: { cancelledAt: new Date() } }),
    prisma.assessmentBooking.updateMany({
      where: { sessionId: id, status: "BOOKED" },
      data: { status: "CANCELLED" },
    }),
  ]);

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "archive",
    entity: "AssessmentSession",
    entityId: id,
    programmeId: existing.programmeId,
    summary:
      `Cancelled the assessment session on ${sessionLabel(existing)}` +
      (existing._count.bookings
        ? ` and the ${existing._count.bookings} ${existing._count.bookings === 1 ? "booking" : "bookings"} on it`
        : ""),
  });

  revalidatePath("/assessments");
  revalidatePath("/assessments/[id]", "page");
  return ok();
}
