"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { can, canSee, requirePermission, AuthorizationError } from "@/lib/authz";
import type { Session } from "next-auth";
import { currentClubId } from "@/lib/clubs/current";
import { DAY_META, courseLabel } from "@/lib/courses/constants";
import { formatDate, isDateOnly, parseDateOnly, today, weekdayOf } from "@/lib/format";
import { withCourseSeat } from "@/lib/enrolment/seat";

/** Confirm who is teaching a class on a date. The existing ClassCover record
 * now includes scheduled instructors as well as substitutes. Claims and their
 * audit entries are created together under the course lock and never replaced. */


const takeOverSchema = z.object({
  courseId: z.string().min(1),
  date: z.string().refine(isDateOnly, "That is not a date."),
});

export type TakeOverInput = z.infer<typeof takeOverSchema>;

export async function takeOverClass(input: TakeOverInput): Promise<ActionResult> {
  const session = await requirePermission("attendance.cover");
  return claim(input, session, false);
}

/** Confirmation is required for scheduled instructors as well as cover.
 * The course lock makes concurrent confirmations a single-winner operation. */
export async function startClass(input: TakeOverInput): Promise<ActionResult> {
  const session = await requirePermission("attendance.mark");
  if (!canSee(session, "instructor")) throw new AuthorizationError("Instructor access is required.");
  return claim(input, session, true);
}

async function claim(input: TakeOverInput, session: Session, starting: boolean): Promise<ActionResult> {

  const parsed = takeOverSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { courseId, date: iso } = parsed.data;

  const clubId = await currentClubId();
  const result = await withCourseSeat(courseId, async (tx) => {
    const course = await tx.course.findUnique({
      where: { id: courseId, clubId },
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
    if (!course) return fail("That class no longer exists.");
    if (course.archivedAt) return fail("That class is archived.");
    const own = course.instructorId === session.user.id;
    if (!own && !can(session, "attendance.cover")) return fail("You do not have permission to start another instructor’s class.");

    // The same two guards as the register, for the same reason: a cover on a
    // day the class never ran is as wrong as a mark on one.
    const date = parseDateOnly(iso);
    if (weekdayOf(date) !== course.dayOfWeek) {
      return fail(
        `${courseLabel(course)} runs on ${DAY_META[course.dayOfWeek].label}s. ${formatDate(date)} is not one.`
      );
    }
    if (iso > today()) return fail("You cannot take over a class that has not happened yet.");
    if (starting && iso !== today()) return fail("Start a class on the day it runs. Return to today’s classes.");

    const existing = await tx.classCover.findUnique({
      where: { courseId_date: { courseId, date } },
      select: { coverById: true, coverByName: true },
    });
    if (existing?.coverById === session.user.id) return ok();
    if (existing) return fail(`This class has already been started by ${existing.coverByName}. Only that instructor can open it.`);

    const name = session.user.name ?? "Unknown";
    const record = {
      coverById: session.user.id,
      coverByName: name,
      instructorId: course.instructorId,
      instructorName: course.instructor?.name ?? null,
    };

    await tx.classCover.create({ data: { courseId, date, ...record } });

    await logAudit({
      actorId: session.user.id,
      actorName: name,
      action: own ? "start-class" : "cover",
      entity: "Course",
      entityId: courseId,
      programmeId: course.level.programmeId,
      clubId,
      summary:
        `Started ${courseLabel(course)} on ${formatDate(date)}` +
        (own ? " as its scheduled instructor" : course.instructor ? `, covering for ${course.instructor.name}` : " — nobody was assigned"),
    }, tx);
    return ok();
  });
  if (!result.ok) return result;

  revalidatePath("/courses/[id]/register", "page");
  revalidatePath("/courses/[id]/assess", "page");
  revalidatePath("/courses/[id]/class", "page");
  revalidatePath("/today");
  revalidatePath("/instructor");
  revalidatePath("/instructor/classes/[id]", "page");
  revalidatePath("/");
  return ok();
}
