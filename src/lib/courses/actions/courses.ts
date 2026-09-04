"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { DayOfWeek } from "@/generated/prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { courseLabel, formatSlot, parseTime } from "@/lib/courses/constants";
import { TAKES_A_PLACE } from "@/lib/courses/data/courses";
import { prisma } from "@/lib/prisma";

/** A course is part of the timetable, which is a rule rather than a day's
 *  data — so these are admin tier. Enrolling somebody into one is not. */

const courseSchema = z.object({
  levelId: z.string().min(1, "Pick the level this class teaches."),
  name: z.string().trim().max(80, "Keep the name under 80 characters."),
  dayOfWeek: z.enum([
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ]),
  startTime: z.string().trim().min(1, "Give the class a start time."),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(5, "A class has to last at least 5 minutes.")
    .max(240, "Four hours is the longest a class can be."),
  capacity: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{1,3}$/.test(v), "Capacity has to be a whole number, or blank."),
  instructorId: z.string(),
  location: z.string().trim().max(80, "Keep the location under 80 characters."),
});

export type CourseInput = z.input<typeof courseSchema>;

type CourseData = {
  levelId: string;
  name: string | null;
  dayOfWeek: DayOfWeek;
  startMinutes: number;
  durationMinutes: number;
  capacity: number | null;
  instructorId: string | null;
  location: string | null;
};

/** A discriminated result rather than two differently-shaped objects: without
 *  the `ok` flag, TypeScript merges the branches into one type with both
 *  properties optional and `resolved.error` comes out `string | undefined`. */
type Resolved = { ok: false; error: string } | { ok: true; data: CourseData };

function resolve(input: CourseInput): Resolved {
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const startMinutes = parseTime(parsed.data.startTime);
  if (startMinutes === null) {
    return { ok: false, error: "Give the start time as a 24-hour clock time." };
  }

  return {
    ok: true,
    data: {
      levelId: parsed.data.levelId,
      name: parsed.data.name || null,
      dayOfWeek: parsed.data.dayOfWeek,
      startMinutes,
      durationMinutes: parsed.data.durationMinutes,
      capacity: parsed.data.capacity === "" ? null : Number(parsed.data.capacity),
      instructorId: parsed.data.instructorId || null,
      location: parsed.data.location || null,
    },
  };
}

export async function createCourse(input: CourseInput): Promise<ActionResult> {
  const session = await requirePermission("courses.manage");

  const resolved = resolve(input);
  if (!resolved.ok) return fail(resolved.error);
  const data = resolved.data;

  const level = await prisma.level.findUnique({
    where: { id: data.levelId },
    select: {
      id: true,
      name: true,
      archivedAt: true,
      programmeId: true,
      programme: { select: { clubId: true } },
    },
  });
  if (!level) return fail("That level no longer exists.");
  if (level.archivedAt) return fail(`${level.name} is archived. Restore it first.`);

  const course = await prisma.course.create({
    // A class belongs to the club whose curriculum it teaches — the level's,
    // not the cookie's, so the two can never disagree.
    data: { ...data, clubId: level.programme.clubId },
    select: {
      id: true,
      name: true,
      dayOfWeek: true,
      startMinutes: true,
      durationMinutes: true,
      level: { select: { name: true } },
    },
  });

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "create",
    entity: "Course",
    entityId: course.id,
    programmeId: level.programmeId,
    summary: `Added course ${courseLabel(course)} teaching ${level.name}, ${formatSlot(course)}`,
  });

  revalidatePath("/courses");
  return ok();
}

export async function updateCourse(id: string, input: CourseInput): Promise<ActionResult> {
  const session = await requirePermission("courses.manage");

  const resolved = resolve(input);
  if (!resolved.ok) return fail(resolved.error);
  const data = resolved.data;

  const existing = await prisma.course.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      levelId: true,
      dayOfWeek: true,
      startMinutes: true,
      durationMinutes: true,
      capacity: true,
      location: true,
      instructorId: true,
      level: { select: { name: true, programmeId: true } },
      instructor: { select: { name: true } },
      _count: { select: { enrolments: { where: TAKES_A_PLACE } } },
    },
  });
  if (!existing) return fail("That class no longer exists.");

  const taken = existing._count.enrolments;

  // An enrolment pins the level the student was placed at. Re-badging a course
  // under people who are already in it would leave a roster of swimmers placed
  // at one level sitting in a class that claims to teach another.
  if (data.levelId !== existing.levelId && taken > 0) {
    return fail(
      `${taken} ${taken === 1 ? "swimmer is" : "swimmers are"} enrolled at ${existing.level.name}. End those enrolments, or make a new course for the other level.`
    );
  }

  const level = await prisma.level.findUnique({
    where: { id: data.levelId },
    select: { id: true, name: true, archivedAt: true, programmeId: true },
  });
  if (!level) return fail("That level no longer exists.");
  if (level.archivedAt && level.id !== existing.levelId) {
    return fail(`${level.name} is archived. Restore it first.`);
  }

  const changes: string[] = [];
  if (data.levelId !== existing.levelId) changes.push(`level ${existing.level.name} → ${level.name}`);
  if ((data.name ?? "") !== (existing.name ?? "")) changes.push("name");
  if (data.dayOfWeek !== existing.dayOfWeek || data.startMinutes !== existing.startMinutes) {
    changes.push(
      `slot ${formatSlot(existing)} → ${formatSlot({ ...data, dayOfWeek: data.dayOfWeek })}`
    );
  } else if (data.durationMinutes !== existing.durationMinutes) {
    changes.push(`duration ${existing.durationMinutes} → ${data.durationMinutes} min`);
  }
  if (data.capacity !== existing.capacity) {
    changes.push(`capacity ${existing.capacity ?? "uncapped"} → ${data.capacity ?? "uncapped"}`);
  }
  if (data.instructorId !== existing.instructorId) changes.push("instructor");
  if ((data.location ?? "") !== (existing.location ?? "")) changes.push("location");

  // The pool genuinely shrinks sometimes. Refusing would be wrong; saying
  // nothing would be worse, so the overage goes in the log.
  const overage =
    data.capacity !== null && taken > data.capacity ? taken - data.capacity : 0;

  const course = await prisma.course.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      dayOfWeek: true,
      startMinutes: true,
      level: { select: { name: true } },
    },
  });

  if (changes.length > 0) {
    await logAudit({
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: "update",
      entity: "Course",
      entityId: id,
      programmeId: level.programmeId,
      summary:
        `Updated course ${courseLabel(course)} (${changes.join(", ")})` +
        (overage > 0 ? ` — now ${overage} over capacity` : ""),
    });
  }

  revalidatePath("/courses");
  revalidatePath("/courses/[id]", "page");
  return ok();
}

export async function setCourseArchived(id: string, archived: boolean): Promise<ActionResult> {
  const session = await requirePermission("courses.manage");

  const existing = await prisma.course.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      archivedAt: true,
      dayOfWeek: true,
      startMinutes: true,
      level: { select: { name: true, programmeId: true } },
      _count: { select: { enrolments: { where: TAKES_A_PLACE } } },
    },
  });
  if (!existing) return fail("That class no longer exists.");
  if (Boolean(existing.archivedAt) === archived) return ok();

  if (archived && existing._count.enrolments > 0) {
    const n = existing._count.enrolments;
    return fail(
      `${n} ${n === 1 ? "swimmer is" : "swimmers are"} still enrolled. End or move ${n === 1 ? "that enrolment" : "those enrolments"} first.`
    );
  }

  await prisma.course.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: archived ? "archive" : "restore",
    entity: "Course",
    entityId: id,
    programmeId: existing.level.programmeId,
    summary: `${archived ? "Archived" : "Restored"} course ${courseLabel(existing)}`,
  });

  revalidatePath("/courses");
  revalidatePath("/courses/[id]", "page");
  return ok();
}
