import { may, siteFilter } from "@/access/grants";
import type { Account } from "@/access/session";
import { dayOnly } from "@/data/dates";
import { db } from "@/data/db";
import { sharedRoots, waiting, type Reason } from "./waiting";

/** One job on the desk home: how many are waiting, in the desk's words, and where it opens. */
export type Job = { key: "places" | "payments" | "calls" | "updates"; count: number; title: string; line: string; nothing: string; path: string };

const PLACES = { id: true, programmeId: true, status: true, startedOn: true, endedOn: true } as const;

/** Swimmers waiting for a class place at the person's sites (./waiting.ts has the rule). */
async function waitingForAPlace(account: Account): Promise<number> {
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
        id: true, studentId: true, assessedOn: true,
        session: { select: { clubId: true, programmeId: true, date: true, startMinutes: true } },
        student: { select: { enrolments: { select: PLACES } } },
      },
    }),
    db.manualPlacement.findMany({
      where: { removedAt: null, student: active },
      select: { id: true, studentId: true, clubId: true, programmeId: true, createdAt: true, student: { select: { enrolments: { select: PLACES } } } },
    }),
    db.enrolment.findMany({ where: { status: "WAITLISTED", course: { clubId: sites }, student: active }, select: { studentId: true, programmeId: true } }),
    db.programme.findMany({ select: { id: true, sharedWithId: true } }),
  ]);
  const reasons: Reason[] = [
    ...assessed.map((row) => ({
      id: row.id, studentId: row.studentId, siteId: row.session.clubId, programmeId: row.session.programmeId,
      queuedOn: row.assessedOn ?? row.session.date, order: [row.session.date.getTime(), row.session.startMinutes] as const, places: row.student.enrolments,
    })),
    ...byHand.map((row) => ({
      id: row.id, studentId: row.studentId, siteId: row.clubId, programmeId: row.programmeId,
      queuedOn: dayOnly(row.createdAt), order: [row.createdAt.getTime(), 0] as const, places: row.student.enrolments,
    })),
  ];
  // Whether a withdrawn place began as a waiting-list entry is in Turnfin's activity log, which
  // recorded each place's history before Courses had a log of its own. Read only.
  const withdrawn = [...new Set(reasons.flatMap((reason) => reason.places.filter((place) => place.status === "WITHDRAWN").map((place) => place.id)))];
  const history = withdrawn.length
    ? await db.auditLog.findMany({ where: { entity: "Enrolment", entityId: { in: withdrawn }, action: { in: ["waitlist", "enrol"] } }, select: { entityId: true, action: true } })
    : [];
  const idsFor = (action: string) => new Set(history.filter((row) => row.action === action).flatMap((row) => (row.entityId ? [row.entityId] : [])));
  return waiting({
    reasons, waitingLists,
    siteIds: account.access.siteIds.length ? new Set(account.access.siteIds) : null,
    programmeOf: sharedRoots(programmes),
    beganAsWaitingList: idsFor("waitlist"),
    everAPlace: idsFor("enrol"),
  }).size;
}

/** The jobs waiting for this person, in the order the desk works them. A job shows only to
 *  someone whose role opens it; one with nothing waiting still shows, so the tiles never move. */
export async function jobsFor(account: Account): Promise<Job[]> {
  const sites = siteFilter(account.access);
  const desk = may(account.access, "desk");
  const tutor = may(account.access, "tutor");
  const [places, payments, updates, calls] = await Promise.all([
    desk ? waitingForAPlace(account) : null,
    desk ? db.paymentFailure.count({ where: { orgId: account.orgId, siteId: sites, status: "to_contact" } }) : null,
    desk ? db.parentChangeRequest.count({ where: { status: "PENDING", student: { clubId: sites } } }) : null,
    tutor
      ? db.academyCandidate.count({
          where: { source: "online", payment: "owed", status: "booked", course: { cancelledAt: null, status: { not: "completed" }, siteId: sites } },
        })
      : null,
  ]);
  const jobs: Job[] = [];
  if (places !== null) jobs.push({ key: "places", count: places, title: "Place a swimmer", line: "waiting for a class", nothing: "Nobody is waiting", path: "/awaiting-enrolment" });
  if (payments !== null) jobs.push({ key: "payments", count: payments, title: "Failed payments", line: "to contact", nothing: "None to contact", path: "/payments?show=to_contact" });
  if (calls !== null) jobs.push({ key: "calls", count: calls, title: "Phone back", line: "about a course", nothing: "Nobody to phone", path: "/academy/calls" });
  if (updates !== null) jobs.push({ key: "updates", count: updates, title: "Parent updates", line: "to check", nothing: "None to check", path: "/students/parent-changes" });
  return jobs;
}

/** A swimmer found by the desk's search: only what names them. No contact details, no notes. */
export type Found = { id: string; name: string; memberNumber: string | null; site: string };

/** Find swimmers at the person's sites by name, family contact's name or member number.
 *  Every word must match somewhere. Needs the desk grant; the caller has checked it. */
export async function findSwimmers(account: Account, query: string): Promise<Found[]> {
  const terms = query.trim().slice(0, 100).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const rows = await db.student.findMany({
    where: {
      clubId: siteFilter(account.access),
      club: { orgId: account.orgId },
      AND: terms.map((term) => ({ OR: [
        { firstName: { contains: term, mode: "insensitive" as const } },
        { lastName: { contains: term, mode: "insensitive" as const } },
        { contactName: { contains: term, mode: "insensitive" as const } },
        { memberNumber: { contains: term, mode: "insensitive" as const } },
      ] })),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
    take: 25,
    select: { id: true, firstName: true, lastName: true, memberNumber: true, club: { select: { name: true } } },
  });
  return rows.map((row) => ({ id: row.id, name: `${row.firstName} ${row.lastName}`.trim(), memberNumber: row.memberNumber, site: row.club.name }));
}
