import type { Prisma } from "@/generated/prisma/client";
import { isArchivedSite } from "@/lib/directory";
import { logAudit } from "@/lib/audit";
import { parseDateOnly, today } from "@/lib/format";
import { capacityLabel, courseLabelWithSite as courseLabel } from "@/modules/activities/shared/courses/constants";
import { readSharedCurriculum, sharedCourse } from "@/modules/activities/shared/curriculum/data/shared";
import { agreementRecord, LEGEND_AGREEMENT_META, type LegendAgreementChoice } from "@/modules/activities/shared/enrolment/legend-agreement";
import { assessedElsewhere, COURSE_SELECT, placementFor } from "@/modules/activities/shared/enrolment/rules";
import { fullName } from "@/modules/activities/shared/students/constants";

/** "Move them here" (owner request, 21 October 2026): put the group into one of Together's
 *  options in one go. Each child either moves from a place they hold (the same as Move on their
 *  profile: the old place ends as transferred, the new one starts today with its Legend
 *  agreement) or takes a new place (the same as Enrol: the Legend agreement is asked for). The
 *  usual rules hold: a level they have not earned needs a reason that goes on their record, a
 *  class assessed at another centre is warned about, a full class refuses. All of the moves
 *  happen together or none do. */

export type MoveStep = {
  studentId: string;
  toCourseId: string;
  /** The place to move from; null takes a new place and keeps any others. */
  fromEnrolmentId: string | null;
  reason?: string;
  legendAgreement?: LegendAgreementChoice;
};

export type StepCheck = {
  studentId: string;
  /** False: the level is not earned, so a reason is needed. */
  earned: boolean;
  /** The level below the new class, for the reason's question. */
  below: string | null;
  /** Assessed at another centre than the new class's. */
  elsewhere: { assessedAt: string; classAt: string } | null;
  /** Why this one cannot go ahead now, or null. */
  problem: string | null;
};

type Session = { user: { id: string; name?: string | null } };

/** Thrown inside the transaction so nothing written before it is kept. */
export class MoveRefused extends Error {
  constructor(message: string, readonly fieldErrors?: Record<string, string>) { super(message); }
}

/** Every class a set of steps touches, for withCourseSeat to lock. */
export async function coursesOf(db: Prisma.TransactionClient, steps: MoveStep[]) {
  const from = steps.flatMap((step) => step.fromEnrolmentId ? [step.fromEnrolmentId] : []);
  const rows = from.length ? await db.enrolment.findMany({ where: { id: { in: from } }, select: { courseId: true } }) : [];
  return [...steps.map((step) => step.toCourseId), ...rows.map((row) => row.courseId)];
}

/** Reads every step against the locked classes, in order, counting the places earlier steps
 *  take. With `session`, makes the moves; without, only says what would happen. */
export async function runMove(tx: Prisma.TransactionClient, steps: MoveStep[], session?: Session): Promise<StepCheck[]> {
  const curriculum = await readSharedCurriculum(tx);
  const taking = new Map<string, number>();
  const checks: StepCheck[] = [];
  for (const step of steps) {
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${step.studentId} FOR UPDATE`;
    const [student, raw, from] = await Promise.all([
      tx.student.findUnique({ where: { id: step.studentId }, select: { firstName: true, lastName: true, status: true } }),
      tx.course.findUnique({ where: { id: step.toCourseId }, select: COURSE_SELECT }),
      step.fromEnrolmentId ? tx.enrolment.findUnique({ where: { id: step.fromEnrolmentId }, select: {
        id: true, studentId: true, status: true, programmeId: true, legendAgreementStatus: true, legendAgreementUpdatedAt: true,
        legendAgreementUpdatedById: true, legendAgreementUpdatedByName: true, course: { select: COURSE_SELECT },
      } }) : Promise.resolve(null),
    ]);
    const check: StepCheck = { studentId: step.studentId, earned: true, below: null, elsewhere: null, problem: null };
    checks.push(check);
    const name = student ? fullName(student) : "This swimmer";
    const to = raw ? sharedCourse(raw, curriculum) : null;
    if (!student) check.problem = "This swimmer no longer exists.";
    else if (student.status !== "ACTIVE") check.problem = `${name} is marked inactive.`;
    else if (!to) check.problem = "That class no longer exists.";
    else if (to.archivedAt || await isArchivedSite(to.clubId, tx)) check.problem = "That class or its site is archived.";
    else if (to.level.archivedAt || to.level.programme.archivedAt) check.problem = "That class's level or programme is archived.";
    else if (step.fromEnrolmentId && (!from || from.studentId !== step.studentId || from.status !== "ACTIVE")) check.problem = `${name}'s current place has changed since this page loaded.`;
    if (check.problem && session) throw new MoveRefused(`${check.problem} Nothing has changed.`);
    if (check.problem || !to || !student) continue;

    const open = await tx.enrolment.findFirst({
      where: { studentId: step.studentId, courseId: step.toCourseId, status: { in: ["ACTIVE", "WAITLISTED"] } }, select: { id: true },
    });
    if (open) check.problem = `${name} is already in that class or on its waitlist.`;
    const taken = await tx.enrolment.count({ where: { courseId: step.toCourseId, status: "ACTIVE" } }) + (session ? 0 : taking.get(step.toCourseId) ?? 0);
    if (!open && to.capacity !== null && taken >= to.capacity) check.problem = `${courseLabel(to)} is now full (${capacityLabel(taken, to.capacity)}).`;
    if (check.problem && session) throw new MoveRefused(`${check.problem} Nothing has changed.`);
    if (check.problem) continue;
    taking.set(step.toCourseId, (taking.get(step.toCourseId) ?? 0) + 1);

    const { earned, below } = await placementFor(tx, step.studentId, to);
    check.earned = earned;
    check.below = below?.name ?? null;
    check.elsewhere = await assessedElsewhere(tx, step.studentId, to);
    if (!session) continue;

    const reason = step.reason?.trim() ?? "";
    if (!earned && !reason) throw new MoveRefused(`Say why ${name} is being placed at ${to.level.name}.`, { [`reason-${step.studentId}`]: "Say why; it goes on their record." });
    if (!from && !step.legendAgreement) throw new MoveRefused(`Say whether ${name}'s billing agreement has been updated in Legend.`, { [`legend-${step.studentId}`]: "Choose Updated in Legend or Still to do." });

    const startedOn = parseDateOnly(today());
    const actor = { actorId: session.user.id, actorName: session.user.name ?? "Unknown" };
    const warned = check.elsewhere ? ` — assessed at ${check.elsewhere.assessedAt}, placed at ${check.elsewhere.classAt} after a warning` : "";
    const placed = earned ? "" : ` — placed out of sequence: ${reason}`;
    if (from) {
      await tx.enrolment.update({ where: { id: from.id }, data: { status: "TRANSFERRED", endedOn: startedOn, scheduledEndOn: null } });
      const created = await tx.enrolment.create({ data: {
        studentId: step.studentId, courseId: to.id, levelId: to.levelId, programmeId: to.level.programmeId, status: "ACTIVE", startedOn,
        placementReason: earned ? null : reason,
        legendAgreementStatus: from.legendAgreementStatus, legendAgreementUpdatedAt: from.legendAgreementUpdatedAt,
        legendAgreementUpdatedById: from.legendAgreementUpdatedById, legendAgreementUpdatedByName: from.legendAgreementUpdatedByName,
      }, select: { id: true } });
      await logAudit({ ...actor, action: "transfer", entity: "Enrolment", entityId: created.id, programmeId: to.level.programmeId, clubId: to.clubId,
        summary: `Moved ${name} from ${courseLabel(from.course)} to ${courseLabel(to)} from Together${placed}${warned}` }, tx);
      if (from.course.clubId !== to.clubId) {
        await logAudit({ ...actor, action: "transfer-out", entity: "Enrolment", entityId: from.id, programmeId: from.programmeId, clubId: from.course.clubId,
          summary: `Moved ${name} from ${courseLabel(from.course)} to ${courseLabel(to)} from Together` }, tx);
      }
    } else {
      const legend = step.legendAgreement!;
      const created = await tx.enrolment.create({ data: {
        studentId: step.studentId, courseId: to.id, levelId: to.levelId, programmeId: to.level.programmeId, status: "ACTIVE", startedOn,
        placementReason: earned ? null : reason, ...agreementRecord(legend, session.user),
      }, select: { id: true } });
      await logAudit({ ...actor, action: "enrol", entity: "Enrolment", entityId: created.id, programmeId: to.level.programmeId, clubId: to.clubId,
        summary: `Enrolled ${name} in ${courseLabel(to)} at ${to.level.name} from Together — Legend agreement: ${LEGEND_AGREEMENT_META[legend].label}${placed}${warned}` }, tx);
    }
  }
  return checks;
}
