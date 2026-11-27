"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { may } from "@/access/grants";
import { requireAccount } from "@/access/session";
import { clock, dayOnly } from "@/data/dates";
import { db } from "@/data/db";
import { log } from "@/data/log";
import { hasEarnedPlace, sharedRoots } from "./waiting";

/** Why a place could not be made, as the page says it (./reasons.ts holds the sentences). */
type Refusal = "gone" | "inactive" | "archived" | "already" | "full" | "not-earned" | "other-site";

const Input = z.object({ studentId: z.string().min(1).max(100), courseId: z.string().min(1).max(100), at: z.coerce.number().int().min(0).max(100_000).catch(0) });
const SHORT_DAY = { MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun" } as const;

/** Put a waiting swimmer in a class that has a free place.
 *
 *  The same guards as Turnfin's own enrolment, in the same order, because both write the same
 *  table: the class row is locked so two desks cannot take the last place, then the swimmer,
 *  and everything is read again under those locks. This page only ever makes the plain case.
 *  Anything Turnfin would stop to ask about (a place above the level they earned, a class at a
 *  centre other than the one that assessed them) is refused here and done there.
 *
 *  Existing places in other classes are kept. The billing agreement is recorded as still to do,
 *  for the Billing to confirm tile. The place, Courses' log row and Turnfin's activity log row
 *  commit together. */
export async function placeSwimmer(form: FormData): Promise<void> {
  const account = await requireAccount();
  const parsed = Input.safeParse({ studentId: form.get("studentId"), courseId: form.get("courseId"), at: form.get("at") });
  if (!parsed.success) redirect("/place");
  const { studentId, courseId, at } = parsed.data;
  const back = (refusal: Refusal): never => redirect(`/place?at=${at}&refused=${refusal}`);

  const site = await db.course.findFirst({ where: { id: courseId, club: { orgId: account.orgId } }, select: { clubId: true } });
  if (!site || !may(account.access, "desk", site.clubId)) return back("gone");

  const outcome = await db.$transaction(async (tx): Promise<{ enrolmentId: string } | { refusal: Refusal }> => {
    await tx.$queryRaw`SELECT id FROM "Course" WHERE id = ${courseId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${studentId} FOR UPDATE`;
    const [student, course, levels, programmes, actor] = await Promise.all([
      tx.student.findUnique({ where: { id: studentId }, select: { id: true, firstName: true, lastName: true, status: true } }),
      tx.course.findUnique({
        where: { id: courseId },
        select: { id: true, clubId: true, name: true, dayOfWeek: true, startMinutes: true, capacity: true, archivedAt: true, levelId: true, club: { select: { archivedAt: true } } },
      }),
      tx.level.findMany({ select: { id: true, sharedWithId: true, name: true, sortOrder: true, archivedAt: true, programmeId: true } }),
      tx.programme.findMany({ select: { id: true, sharedWithId: true, archivedAt: true } }),
      tx.user.findUnique({ where: { id: account.id }, select: { actsAsSystem: true } }),
    ]);
    if (!student || !course) return { refusal: "gone" };
    if (student.status !== "ACTIVE") return { refusal: "inactive" };

    // A class at one site may use that site's copy of a shared level: the shared one is the level.
    const levelOf = sharedRoots(levels);
    const programmeOf = sharedRoots(programmes);
    const level = levels.find((row) => row.id === levelOf(course.levelId));
    const programme = level && programmes.find((row) => row.id === programmeOf(level.programmeId));
    if (!level || !programme) return { refusal: "gone" };
    if (course.archivedAt || course.club.archivedAt || level.archivedAt || programme.archivedAt) return { refusal: "archived" };

    const open = await tx.enrolment.findFirst({ where: { studentId, courseId, status: { in: ["ACTIVE", "WAITLISTED"] } }, select: { id: true } });
    if (open) return { refusal: "already" };

    const inProgramme = { in: programmes.filter((row) => programmeOf(row.id) === programme.id).map((row) => row.id) };
    const [completions, actives, assessments, latest] = await Promise.all([
      tx.levelCompletion.findMany({ where: { studentId, programmeId: inProgramme }, select: { levelId: true } }),
      tx.enrolment.findMany({ where: { studentId, programmeId: inProgramme, status: "ACTIVE" }, select: { levelId: true } }),
      tx.assessmentBooking.findMany({ where: { studentId, status: "ATTENDED", outcomeLevelId: { not: null }, session: { programmeId: inProgramme } }, select: { outcomeLevelId: true } }),
      tx.assessmentBooking.findFirst({
        where: { studentId, status: "ATTENDED", session: { programmeId: inProgramme } },
        orderBy: [{ session: { date: "desc" } }, { session: { startMinutes: "desc" } }],
        select: { session: { select: { clubId: true } } },
      }),
    ]);
    const orderedLevels = levels
      .filter((row) => !row.sharedWithId && !row.archivedAt && programmeOf(row.programmeId) === programme.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const earned = hasEarnedPlace({
      targetLevelId: level.id, orderedLevels,
      completedLevelIds: new Set(completions.map((row) => levelOf(row.levelId))),
      activeLevelIds: new Set(actives.map((row) => levelOf(row.levelId))),
      assessedLevelIds: new Set(assessments.flatMap((row) => (row.outcomeLevelId ? [levelOf(row.outcomeLevelId)] : []))),
    });
    if (!earned) return { refusal: "not-earned" };
    // Parents are told lessons are at the centre that assessed their child (owner, 20 October 2026).
    if (latest && latest.session.clubId !== course.clubId) return { refusal: "other-site" };

    const taken = await tx.enrolment.count({ where: { courseId, status: "ACTIVE" } });
    if (course.capacity !== null && taken >= course.capacity) return { refusal: "full" };

    const now = new Date();
    const enrolment = await tx.enrolment.create({
      data: {
        studentId, courseId, levelId: level.id, programmeId: programme.id, status: "ACTIVE", startedOn: dayOnly(now),
        legendAgreementStatus: "PENDING", legendAgreementUpdatedAt: now, legendAgreementUpdatedById: account.id, legendAgreementUpdatedByName: account.name,
      },
      select: { id: true },
    });
    const name = `${student.firstName} ${student.lastName}`.trim();
    const label = `${course.name ?? level.name} · ${SHORT_DAY[course.dayOfWeek]} ${clock(course.startMinutes)}`;
    // Turnfin's activity log still shows every place change while both run on these records
    // (reports and the swimmer's history read it), so the row is written in its shape.
    await tx.auditLog.create({
      data: {
        actorId: account.id, actorName: account.name, action: "enrol", entity: "Enrolment", entityId: enrolment.id,
        programmeId: programme.id, clubId: course.clubId, module: "Swim school",
        summary: `Enrolled ${name} in ${label} at ${level.name} — Legend agreement: Still to do`,
        details: { from: "Turnfin Courses" },
        ...(actor?.actsAsSystem ? { system: true } : {}),
      },
    });
    await log(tx, {
      orgId: account.orgId, account, action: "place.made", record: "enrolment", recordId: enrolment.id, siteId: course.clubId,
      detail: { studentId, courseId, levelId: level.id, billing: "PENDING" },
    });
    return { enrolmentId: enrolment.id };
  }, { timeout: 10_000 });

  if ("refusal" in outcome) return back(outcome.refusal);
  revalidatePath("/");
  revalidatePath("/place");
  // The swimmer has left the queue, so the same position now holds the next one.
  redirect(`/place?at=${at}&placed=${outcome.enrolmentId}`);
}
