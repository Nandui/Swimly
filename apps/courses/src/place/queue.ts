import { siteFilter } from "@/access/grants";
import type { Account } from "@/access/session";
import { dayOnly } from "@/data/dates";
import { db } from "@/data/db";
import { sharedRoots, waitingQueue, type Reason, type Waiting } from "./waiting";

const PLACES = { id: true, programmeId: true, status: true, startedOn: true, endedOn: true } as const;

/** Everyone waiting for a class place at the person's sites, longest wait first
 *  (./waiting.ts has the rule). Ids only: no names, contacts or notes are read here. */
export async function waitingFor(account: Account): Promise<Waiting[]> {
  const sites = siteFilter(account.access);
  const active = { status: "ACTIVE" as const };
  const [assessed, byHand, waitingLists, programmes] = await Promise.all([
    db.assessmentBooking.findMany({
      where: {
        status: "ATTENDED", outcomeLevelId: { not: null },
        student: { ...active, OR: [
          { assessmentBookings: { some: { status: "ATTENDED", outcomeLevelId: { not: null }, session: { clubId: sites } } } },
          { manualPlacements: { some: { clubId: sites, removedAt: null } } },
        ] },
      },
      select: {
        id: true, studentId: true, assessedOn: true, outcomeLevelId: true,
        session: { select: { clubId: true, programmeId: true, date: true, startMinutes: true } },
        student: { select: { enrolments: { select: PLACES } } },
      },
    }),
    db.manualPlacement.findMany({
      where: { removedAt: null, student: active },
      select: { id: true, studentId: true, clubId: true, programmeId: true, levelId: true, createdAt: true, student: { select: { enrolments: { select: PLACES } } } },
    }),
    db.enrolment.findMany({ where: { status: "WAITLISTED", course: { clubId: sites }, student: active }, select: { id: true, studentId: true, programmeId: true, createdAt: true } }),
    db.programme.findMany({ select: { id: true, sharedWithId: true } }),
  ]);
  const reasons: Reason[] = [
    ...assessed.map((row) => ({
      id: row.id, studentId: row.studentId, siteId: row.session.clubId, programmeId: row.session.programmeId, levelId: row.outcomeLevelId!,
      queuedOn: row.assessedOn ?? row.session.date, order: [row.session.date.getTime(), row.session.startMinutes] as const, places: row.student.enrolments,
    })),
    ...byHand.map((row) => ({
      id: row.id, studentId: row.studentId, siteId: row.clubId, programmeId: row.programmeId, levelId: row.levelId,
      queuedOn: dayOnly(row.createdAt), order: [row.createdAt.getTime(), 0] as const, places: row.student.enrolments,
    })),
  ];
  // Whether a withdrawn place began as a waiting-list entry is in Turnfin's activity log, which
  // recorded each place's history before Courses had a log of its own.
  const withdrawn = [...new Set(reasons.flatMap((reason) => reason.places.filter((place) => place.status === "WITHDRAWN").map((place) => place.id)))];
  const history = withdrawn.length
    ? await db.auditLog.findMany({ where: { entity: "Enrolment", entityId: { in: withdrawn }, action: { in: ["waitlist", "enrol"] } }, select: { entityId: true, action: true } })
    : [];
  const idsFor = (action: string) => new Set(history.filter((row) => row.action === action).flatMap((row) => (row.entityId ? [row.entityId] : [])));
  return waitingQueue({
    reasons, waitingLists,
    siteIds: account.access.siteIds.length ? new Set(account.access.siteIds) : null,
    programmeOf: sharedRoots(programmes),
    beganAsWaitingList: idsFor("waitlist"),
    everAPlace: idsFor("enrol"),
  });
}
