"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requireManage } from "@/lib/authz";
import { capacityLabel, courseLabel } from "@/lib/courses/constants";
import { parseDateOnly, today } from "@/lib/format";
import { hasEarnedPlace, previousLevel } from "@/lib/progression/rules";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** Enrolment is the data, not the rules — manage tier. Placing a swimmer out
 *  of sequence is included in that on purpose: transfers from another school,
 *  adult beginners and assessment-day placements happen weekly, and making
 *  them admin-only would either turn the front desk into admins or push
 *  somebody into faking a completion to get past the guard. Both are worse
 *  than the thing the guard was for. What it costs instead is a reason, and
 *  the reason is stored on the enrolment where an instructor can read it. */

/** Every path that can occupy a place goes through here, and nothing else
 *  creates an ACTIVE enrolment.
 *
 *  The row lock is the whole mechanism. An interactive transaction that merely
 *  re-counts does **not** fix the race: at READ COMMITTED two transactions both
 *  read 11 and both insert. Locking the course row serialises every seat
 *  decision for that one class, which also makes the "already enrolled here?"
 *  check race-free — which is why there is no unique constraint on
 *  (studentId, courseId), and why repeating a level is possible at all.
 *
 *  Keep the body small. It holds a pool connection, so no audit write and no
 *  revalidation happen inside it. */
async function withCourseSeat<T>(
  courseId: string,
  run: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Course" WHERE id = ${courseId} FOR UPDATE`;
      return run(tx);
    },
    { timeout: 10_000 }
  );
}

const enrolSchema = z.object({
  studentId: z.string().min(1, "Pick a student."),
  courseId: z.string().min(1, "Pick a course."),
  placementReason: z.string().trim().max(300, "Keep the reason under 300 characters."),
  allowWaitlist: z.boolean(),
});

export type EnrolInput = z.infer<typeof enrolSchema>;

export async function enrolStudent(input: EnrolInput): Promise<ActionResult> {
  const session = await requireManage();

  const parsed = enrolSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { studentId, courseId, placementReason, allowWaitlist } = parsed.data;

  const [student, course] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, firstName: true, lastName: true, status: true },
    }),
    prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        name: true,
        dayOfWeek: true,
        startMinutes: true,
        capacity: true,
        archivedAt: true,
        levelId: true,
        level: {
          select: { id: true, name: true, programmeId: true, programme: { select: { name: true } } },
        },
      },
    }),
  ]);

  if (!student) return fail("That student no longer exists.");
  if (student.status !== "ACTIVE") return fail(`${fullName(student)} is marked inactive.`);
  if (!course) return fail("That course no longer exists.");
  if (course.archivedAt) return fail("That course is archived.");

  // Has the swimmer earned this rung? Read the ladder and their history in the
  // one programme this course belongs to.
  const [orderedLevels, completions, actives] = await Promise.all([
    prisma.level.findMany({
      where: { programmeId: course.level.programmeId, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, sortOrder: true },
    }),
    prisma.levelCompletion.findMany({
      where: { studentId, programmeId: course.level.programmeId },
      select: { levelId: true },
    }),
    prisma.enrolment.findMany({
      where: { studentId, programmeId: course.level.programmeId, status: "ACTIVE" },
      select: { levelId: true },
    }),
  ]);

  const earned = hasEarnedPlace({
    targetLevelId: course.levelId,
    orderedLevels,
    completedLevelIds: new Set(completions.map((c) => c.levelId)),
    activeLevelIds: new Set(actives.map((a) => a.levelId)),
  });

  if (!earned && !placementReason) {
    const below = previousLevel(course.levelId, orderedLevels);
    return fail(
      `${fullName(student)} has not completed ${below?.name ?? "the level below"}. Say why they are being placed at ${course.level.name} and it will go on their record.`
    );
  }

  const startedOn = parseDateOnly(today());

  const outcome = await withCourseSeat(courseId, async (tx) => {
    const open = await tx.enrolment.findFirst({
      where: { studentId, courseId, status: { in: ["ACTIVE", "WAITLISTED"] } },
      select: { id: true, status: true },
    });
    if (open) return { kind: "duplicate", status: open.status } as const;

    const taken = await tx.enrolment.count({ where: { courseId, status: "ACTIVE" } });
    const full = course.capacity !== null && taken >= course.capacity;

    if (full && !allowWaitlist) return { kind: "full", taken } as const;

    const enrolment = await tx.enrolment.create({
      data: {
        studentId,
        courseId,
        levelId: course.levelId,
        programmeId: course.level.programmeId,
        status: full ? "WAITLISTED" : "ACTIVE",
        startedOn,
        placementReason: earned ? null : placementReason,
      },
      select: { id: true, status: true },
    });

    return { kind: "created", enrolment, taken } as const;
  });

  if (outcome.kind === "duplicate") {
    return fail(
      outcome.status === "ACTIVE"
        ? `${fullName(student)} is already in that class.`
        : `${fullName(student)} is already on the waitlist for that class.`
    );
  }

  if (outcome.kind === "full") {
    return fail(
      `${courseLabel(course)} is full (${capacityLabel(outcome.taken, course.capacity)}). Tick the waitlist box to put them on it.`
    );
  }

  const waitlisted = outcome.enrolment.status === "WAITLISTED";
  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: waitlisted ? "waitlist" : "enrol",
    entity: "Enrolment",
    entityId: outcome.enrolment.id,
    programmeId: course.level.programmeId,
    summary:
      `${waitlisted ? "Waitlisted" : "Enrolled"} ${fullName(student)} in ${courseLabel(course)} at ${course.level.name}` +
      (earned ? "" : ` — placed out of sequence: ${placementReason}`),
  });

  revalidatePath("/courses");
  revalidatePath("/courses/[id]", "page");
  revalidatePath("/students/[id]", "page");
  return ok();
}

const endSchema = z.object({
  status: z.enum(["WITHDRAWN", "COMPLETED"]),
  note: z.string().trim().max(300),
});

export async function endEnrolment(
  id: string,
  input: z.infer<typeof endSchema>
): Promise<ActionResult> {
  const session = await requireManage();

  const parsed = endSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const enrolment = await prisma.enrolment.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      programmeId: true,
      student: { select: { firstName: true, lastName: true } },
      course: {
        select: {
          name: true,
          dayOfWeek: true,
          startMinutes: true,
          level: { select: { name: true } },
        },
      },
    },
  });
  if (!enrolment) return fail("That enrolment no longer exists.");
  if (enrolment.status !== "ACTIVE" && enrolment.status !== "WAITLISTED") {
    return fail("That enrolment has already ended.");
  }

  await prisma.enrolment.update({
    where: { id },
    data: { status: parsed.data.status, endedOn: parseDateOnly(today()) },
  });

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: parsed.data.status === "COMPLETED" ? "complete" : "withdraw",
    entity: "Enrolment",
    entityId: id,
    programmeId: enrolment.programmeId,
    summary:
      `${parsed.data.status === "COMPLETED" ? "Finished" : "Withdrew"} ${fullName(enrolment.student)} from ${courseLabel(enrolment.course)}` +
      (parsed.data.note ? ` — ${parsed.data.note}` : ""),
  });

  revalidatePath("/courses");
  revalidatePath("/courses/[id]", "page");
  revalidatePath("/students/[id]", "page");
  return ok();
}

/** Promotion is a seat decision like any other, so it takes the same lock. */
export async function promoteFromWaitlist(id: string): Promise<ActionResult> {
  const session = await requireManage();

  const enrolment = await prisma.enrolment.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      courseId: true,
      programmeId: true,
      student: { select: { firstName: true, lastName: true } },
      course: {
        select: {
          name: true,
          dayOfWeek: true,
          startMinutes: true,
          capacity: true,
          level: { select: { name: true } },
        },
      },
    },
  });
  if (!enrolment) return fail("That enrolment no longer exists.");
  if (enrolment.status !== "WAITLISTED") return fail("They are not on the waitlist.");

  const outcome = await withCourseSeat(enrolment.courseId, async (tx) => {
    const taken = await tx.enrolment.count({
      where: { courseId: enrolment.courseId, status: "ACTIVE" },
    });
    if (enrolment.course.capacity !== null && taken >= enrolment.course.capacity) {
      return { kind: "full", taken } as const;
    }
    await tx.enrolment.update({
      where: { id },
      data: { status: "ACTIVE", startedOn: parseDateOnly(today()) },
    });
    return { kind: "promoted", taken } as const;
  });

  if (outcome.kind === "full") {
    return fail(
      `${courseLabel(enrolment.course)} is still full (${capacityLabel(outcome.taken, enrolment.course.capacity)}).`
    );
  }

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "enrol",
    entity: "Enrolment",
    entityId: id,
    programmeId: enrolment.programmeId,
    summary: `Moved ${fullName(enrolment.student)} off the waitlist into ${courseLabel(enrolment.course)}`,
  });

  revalidatePath("/courses");
  revalidatePath("/courses/[id]", "page");
  revalidatePath("/students/[id]", "page");
  return ok();
}

/** Moving class closes one enrolment and opens another. It never mutates
 *  `courseId`: the old attendance is tied to (course, student, date), so
 *  rewriting the enrolment would orphan every register they were already on. */
export async function transferEnrolment(
  id: string,
  toCourseId: string
): Promise<ActionResult> {
  const session = await requireManage();

  const from = await prisma.enrolment.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      studentId: true,
      courseId: true,
      programmeId: true,
      student: { select: { firstName: true, lastName: true } },
      course: {
        select: {
          name: true,
          dayOfWeek: true,
          startMinutes: true,
          level: { select: { name: true } },
        },
      },
    },
  });
  if (!from) return fail("That enrolment no longer exists.");
  if (from.status !== "ACTIVE" && from.status !== "WAITLISTED") {
    return fail("That enrolment has already ended.");
  }
  if (from.courseId === toCourseId) return fail("That is the same class.");

  const to = await prisma.course.findUnique({
    where: { id: toCourseId },
    select: {
      id: true,
      name: true,
      dayOfWeek: true,
      startMinutes: true,
      capacity: true,
      archivedAt: true,
      levelId: true,
      level: { select: { id: true, name: true, programmeId: true } },
    },
  });
  if (!to) return fail("That course no longer exists.");
  if (to.archivedAt) return fail("That course is archived.");

  const startedOn = parseDateOnly(today());

  const outcome = await withCourseSeat(toCourseId, async (tx) => {
    const open = await tx.enrolment.findFirst({
      where: { studentId: from.studentId, courseId: toCourseId, status: { in: ["ACTIVE", "WAITLISTED"] } },
      select: { id: true },
    });
    if (open) return { kind: "duplicate" } as const;

    const taken = await tx.enrolment.count({ where: { courseId: toCourseId, status: "ACTIVE" } });
    if (to.capacity !== null && taken >= to.capacity) return { kind: "full", taken } as const;

    await tx.enrolment.update({
      where: { id },
      data: { status: "TRANSFERRED", endedOn: startedOn },
    });
    const created = await tx.enrolment.create({
      data: {
        studentId: from.studentId,
        courseId: toCourseId,
        levelId: to.levelId,
        programmeId: to.level.programmeId,
        status: "ACTIVE",
        startedOn,
      },
      select: { id: true },
    });
    return { kind: "moved", created } as const;
  });

  if (outcome.kind === "duplicate") {
    return fail(`${fullName(from.student)} is already in that class.`);
  }
  if (outcome.kind === "full") {
    return fail(`${courseLabel(to)} is full (${capacityLabel(outcome.taken, to.capacity)}).`);
  }

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "transfer",
    entity: "Enrolment",
    entityId: outcome.created.id,
    programmeId: to.level.programmeId,
    summary: `Moved ${fullName(from.student)} from ${courseLabel(from.course)} to ${courseLabel(to)}`,
  });

  revalidatePath("/courses");
  revalidatePath("/courses/[id]", "page");
  revalidatePath("/students/[id]", "page");
  return ok();
}
