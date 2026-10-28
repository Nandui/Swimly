import type { Prisma } from "@/generated/prisma/client";
import { parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/modules/activities/shared/students/constants";

/** The swimmers whose place covers one dated session, one row per swimmer. */
export async function sessionRoster(tx: Prisma.TransactionClient, courseId: string, date: Date) {
  const enrolments = await tx.enrolment.findMany({ where: { courseId, status: "ACTIVE", startedOn: { lte: date },
    AND: [{ OR: [{ endedOn: null }, { endedOn: { gte: date } }] },
      { OR: [{ scheduledEndOn: null }, { scheduledEndOn: { gt: date } }] }],
  }, select: { student: { select: { id: true, firstName: true, lastName: true, memberNumber: true } } } });
  return [...new Map(enrolments.map(row => [row.student.id, row.student])).values()]
    .map(student => ({ studentId: student.id, swimmerName: fullName(student), memberNumber: student.memberNumber }));
}

/** Keeps the swimmer list of a cancellation still awaiting billing in step with the class until its
 *  day (owner decision, 28 October 2026): joiners are added and leavers removed. Once billing has
 *  acted, or the day has passed, the list is the evidence and never changes.
 *
 *  Runs inside `withCourseSeat`, after every write that can change a class's places, so no
 *  enrolment path can skip it. The change it follows already carries its own audit row. */
export async function syncCancelledRosters(tx: Prisma.TransactionClient, courseIds: readonly string[]) {
  const open = await tx.classCancellation.findMany({
    where: { courseId: { in: [...courseIds] }, date: { gte: parseDateOnly(today()) }, billingNotifiedAt: null, legendProcessedAt: null },
    select: { id: true, courseId: true, date: true, swimmers: { select: { id: true, studentId: true } } },
  });
  for (const cancellation of open) {
    const roster = await sessionRoster(tx, cancellation.courseId, cancellation.date);
    const wanted = new Set(roster.map(s => s.studentId)), held = new Set(cancellation.swimmers.map(s => s.studentId));
    const leavers = cancellation.swimmers.filter(s => !wanted.has(s.studentId)).map(s => s.id);
    const joiners = roster.filter(s => !held.has(s.studentId));
    if (leavers.length) await tx.cancelledClassSwimmer.deleteMany({ where: { id: { in: leavers } } });
    if (joiners.length) await tx.cancelledClassSwimmer.createMany({ data: joiners.map(s => ({ ...s, cancellationId: cancellation.id })), skipDuplicates: true });
  }
}
