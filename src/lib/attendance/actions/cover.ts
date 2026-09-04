"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { DAY_META, courseLabel } from "@/lib/courses/constants";
import { formatDate, parseDateOnly, today, weekdayOf } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** Taking a class that is not yours.
 *
 *  Cover used to need an admin to reassign the course, which meant a class
 *  going unmarked until somebody at a desk got round to it. Now the person
 *  standing at the pool says so themselves, once, and from then on that day's
 *  register and checklist are theirs to mark — with the register recording
 *  that they conducted the class and whose it was. Self-declared, but never
 *  silent: the row and the audit entry both name them. */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const takeOverSchema = z.object({
  courseId: z.string().min(1),
  date: z.string().regex(ISO_DATE, "That is not a date."),
});

export type TakeOverInput = z.infer<typeof takeOverSchema>;

export async function takeOverClass(input: TakeOverInput): Promise<ActionResult> {
  const session = await requirePermission("attendance.cover");

  const parsed = takeOverSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { courseId, date: iso } = parsed.data;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      name: true,
      dayOfWeek: true,
      startMinutes: true,
      archivedAt: true,
      instructorId: true,
      instructor: { select: { name: true } },
      level: { select: { name: true, programmeId: true } },
    },
  });
  if (!course) return fail("That course no longer exists.");
  if (course.archivedAt) return fail("That course is archived.");
  if (course.instructorId === session.user.id) return fail("It is your class already.");

  // The same two guards as the register, for the same reason: a cover on a
  // day the class never ran is as wrong as a mark on one.
  const date = parseDateOnly(iso);
  if (weekdayOf(date) !== course.dayOfWeek) {
    return fail(
      `${courseLabel(course)} runs on ${DAY_META[course.dayOfWeek].label}s. ${formatDate(date)} is not one.`
    );
  }
  if (iso > today()) return fail("You cannot take over a class that has not happened yet.");

  const existing = await prisma.classCover.findUnique({
    where: { courseId_date: { courseId, date } },
    select: { coverById: true, coverByName: true },
  });
  if (existing?.coverById === session.user.id) return ok();

  const name = session.user.name ?? "Unknown";
  const record = {
    coverById: session.user.id,
    coverByName: name,
    instructorId: course.instructorId,
    instructorName: course.instructor?.name ?? null,
  };

  await prisma.classCover.upsert({
    where: { courseId_date: { courseId, date } },
    create: { courseId, date, ...record },
    update: record,
  });

  await logAudit({
    actorId: session.user.id,
    actorName: name,
    action: "cover",
    entity: "Course",
    entityId: courseId,
    programmeId: course.level.programmeId,
    summary:
      `Took over ${courseLabel(course)} on ${formatDate(date)}` +
      (course.instructor ? ` from ${course.instructor.name}` : " — nobody was assigned") +
      (existing ? ` (${existing.coverByName} had taken it)` : ""),
  });

  revalidatePath("/courses/[id]/register", "page");
  revalidatePath("/courses/[id]/assess", "page");
  revalidatePath("/today");
  revalidatePath("/");
  return ok();
}
