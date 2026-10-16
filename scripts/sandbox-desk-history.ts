import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../src/generated/prisma/client";

/** Four months of made-up reception work at Hillview (club_churchfield) for the Reception
 *  analytics: three invented receptionists, the log rows their work leaves (enrolments, waiting
 *  lists, moves, unenrols, new swimmers, bookings, follow-ups, billing checks), parent app requests
 *  answered at different speeds, swimmers marked ready to move, billing told about cancelled
 *  classes, and Academy call backs. Fiona is quick and careful, Gary is steady, Hazel is slower and
 *  leaves details out. Deterministic, so screenshots repeat. Runs after sandbox-swim-history.ts. */

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HILLVIEW = "club_churchfield";
const HOUR = 3_600_000, DAY = 24 * HOUR;
type Desk = { id: string; name: string; /** hours to answer, typically */ pace: number; /** chance of leaving a detail out */ sloppy: number; weight: number };

export async function seedDeskHistory(db: PrismaClient, receptionRoleId: string) {
  const random = rng(20261017);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const now = Date.now();
  const desk: Desk[] = [
    { id: "sbx_fiona", name: "Fiona Example", pace: 3, sloppy: 0.04, weight: 0.42 },
    { id: "sbx_gary", name: "Gary Example", pace: 10, sloppy: 0.1, weight: 0.33 },
    { id: "sbx_hazel", name: "Hazel Example", pace: 30, sloppy: 0.35, weight: 0.25 },
  ];
  for (const d of desk) {
    await db.user.create({ data: {
      id: d.id, name: d.name, email: `${d.id.slice(4)}@sandbox.invalid`, staffRoleId: receptionRoleId, orgId: "org_leisureworld",
      jobTitle: "Receptionist", primaryClubId: HILLVIEW, siteIds: [HILLVIEW], startedOn: new Date("2025-03-03T00:00:00Z"),
    } });
  }
  const who = () => { const r = random(); let sum = 0; for (const d of desk) { sum += d.weight; if (r < sum) return d; } return desk[0]; };
  /** A moment at the desk on or a few days before a day: busy after school and on Saturday mornings. */
  const atDesk = (day: Date, back = 0) => {
    const d = new Date(day.getTime() - Math.floor(random() * (back + 1)) * DAY);
    const saturday = d.getUTCDay() === 6;
    const hour = saturday ? 8 + Math.floor(random() * 5) : random() < 0.35 ? 9 + Math.floor(random() * 4) : 14 + Math.floor(random() * 6);
    d.setUTCHours(hour - 1, Math.floor(random() * 60), 0, 0); // Irish summer time is an hour ahead
    return d;
  };
  /** A time some hours after another, moved on to desk hours (9:00 to 20:00 Irish time). */
  const later = (base: Date, hours: number) => {
    const d = new Date(base.getTime() + hours * HOUR);
    const local = (d.getUTCHours() + 1) % 24;
    if (local >= 20) d.setUTCDate(d.getUTCDate() + 1);
    if (local >= 20 || local < 9) d.setUTCHours(8 + Math.floor(random() * 4), Math.floor(random() * 60), 0, 0);
    return d;
  };
  const audit: { actorId: string; actorName: string; action: string; entity: string; entityId: string; clubId: string | null; module: string; createdAt: Date }[] = [];
  const log = (d: Desk, action: string, entity: string, entityId: string, at: Date, clubId: string | null = HILLVIEW, module = "Swim school") =>
    audit.push({ actorId: d.id, actorName: d.name, action, entity, entityId, clubId, module, createdAt: at });

  const since = new Date(now - 125 * DAY);
  const places = await db.enrolment.findMany({
    where: { course: { clubId: HILLVIEW }, OR: [{ startedOn: { gte: since } }, { endedOn: { gte: since } }, { status: "WAITLISTED" }] },
    select: { id: true, studentId: true, status: true, startedOn: true, endedOn: true, createdAt: true },
  });
  const earlier = new Set((await db.enrolment.findMany({ where: { status: "TRANSFERRED" }, select: { studentId: true } })).map(p => p.studentId));

  // Places made, waiting lists joined, moves and unenrols.
  const made = new Map<string, { at: Date; by: Desk }>();
  for (const p of places) {
    if (p.status === "WAITLISTED") {
      const at = atDesk(p.startedOn);
      await db.$executeRaw`UPDATE "Enrolment" SET "createdAt" = ${at} WHERE id = ${p.id}`;
      log(who(), "waitlist", "Enrolment", p.id, at);
      continue;
    }
    if (p.startedOn >= since && p.startedOn.getTime() < now) {
      const by = who(), at = atDesk(p.startedOn, 4);
      made.set(p.id, { at, by });
      await db.$executeRaw`UPDATE "Enrolment" SET "createdAt" = ${at} WHERE id = ${p.id}`;
      log(by, earlier.has(p.studentId) && random() < 0.6 ? "transfer" : "enrol", "Enrolment", p.id, at);
      // Most new places get their billing agreement checked; Hazel's take longer.
      const check = who();
      const done = later(at, random() < 0.8 ? 1 + random() * check.pace * 8 : 200 + random() * 300);
      if (done.getTime() < now) {
        await db.enrolment.update({ where: { id: p.id }, data: { legendAgreementStatus: "DONE", legendAgreementUpdatedAt: done, legendAgreementUpdatedById: check.id, legendAgreementUpdatedByName: check.name } });
        log(check, "legend-agreement", "Enrolment", p.id, done);
      } else await db.enrolment.update({ where: { id: p.id }, data: { legendAgreementStatus: "NEEDS_CHECK" } });
    }
    if (p.endedOn && p.endedOn >= since && p.endedOn.getTime() < now && p.status === "WITHDRAWN") log(who(), "withdraw", "Enrolment", p.id, atDesk(p.endedOn, 6));
  }
  // A few places made by mistake and taken off the same day.
  for (const [i, [id, m]] of [...made].entries()) {
    if (i % 23 !== 0) continue;
    const by = m.by.id === "sbx_hazel" || random() < 0.4 ? m.by : desk[2];
    const fake = `sbx_undo_${id}`;
    log(by, "enrol", "Enrolment", fake, m.at);
    log(who(), "withdraw", "Enrolment", fake, new Date(m.at.getTime() + (1 + random() * 5) * HOUR));
  }

  // Some places came off a waiting list: the wait began weeks before the place was given.
  for (const [i, [id, m]] of [...made].entries()) {
    if (i % 4 === 1) log(who(), "waitlist", "Enrolment", id, atDesk(new Date(m.at.getTime() - (5 + random() * 50) * DAY)));
  }

  // New swimmers added at the desk, some without a phone or an emergency number.
  const students = await db.student.findMany({ where: { clubId: HILLVIEW, joinedOn: { gte: since } }, select: { id: true, joinedOn: true } });
  for (const s of students) {
    const by = who(), at = atDesk(s.joinedOn ?? new Date(now - DAY), 3);
    if (at.getTime() > now) continue;
    log(by, "create", "Student", s.id, at);
    const gap = random() < by.sloppy;
    await db.student.update({ where: { id: s.id }, data: { contactPhone: gap && random() < 0.6 ? "" : "000 000 0000", emergencyPhone: gap ? "" : "000 000 0001" } });
    const edit = atDesk(new Date(at.getTime() + Math.floor(random() * 40) * DAY));
    if (random() < 0.5 && edit.getTime() < now) log(who(), "update", "Student", s.id, edit);
  }
  // Older swimmers keep their numbers, so only the new ones are measured.
  await db.student.updateMany({ where: { clubId: HILLVIEW, joinedOn: { lt: since } }, data: { contactPhone: "000 000 0000", emergencyPhone: "000 000 0001" } });

  // Swimmers the teachers marked ready to move: the desk moved most, some still wait.
  const moved = await db.enrolment.findMany({ where: { course: { clubId: HILLVIEW }, status: "TRANSFERRED", endedOn: { gte: since } }, select: { id: true, endedOn: true } });
  for (const p of moved) {
    const wait = (2 + random() * (random() < 0.2 ? 30 : 9)) * DAY;
    await db.enrolment.update({ where: { id: p.id }, data: { readyToMoveAt: new Date(p.endedOn!.getTime() - wait), readyToMoveById: "sbx_ava", readyToMoveByName: "Ava Example" } });
  }
  const stillActive = await db.enrolment.findMany({ where: { course: { clubId: HILLVIEW }, status: "ACTIVE", endedOn: null, scheduledEndOn: null }, select: { id: true }, take: 5 });
  for (const [i, p] of stillActive.entries()) await db.enrolment.update({ where: { id: p.id }, data: { readyToMoveAt: new Date(now - (3 + i * 5) * DAY), readyToMoveById: "sbx_chloe", readyToMoveByName: "Chloe Example" } });
  // The history logs the new place it made for each move; make sure the move itself is logged.
  const newPlaces = await db.$queryRaw<{ id: string; createdAt: Date; startedOn: Date }[]>`
    SELECT n.id, n."createdAt", n."startedOn" FROM "Enrolment" e JOIN "Course" c ON c.id = e."courseId"
    JOIN LATERAL (SELECT x.id, x."createdAt", x."startedOn" FROM "Enrolment" x WHERE x."studentId" = e."studentId" AND x.id <> e.id AND x."startedOn" >= e."endedOn" ORDER BY x."startedOn" LIMIT 1) n ON true
    WHERE c."clubId" = ${HILLVIEW} AND e.status = 'TRANSFERRED' AND e."endedOn" >= ${since}`;
  for (const n of newPlaces) {
    const at = atDesk(n.startedOn, 2);
    if (at.getTime() > now) continue;
    await db.$executeRaw`UPDATE "Enrolment" SET "createdAt" = ${at} WHERE id = ${n.id}`;
    if (!audit.some(a => a.entityId === n.id && a.action === "transfer")) {
      const i = audit.findIndex(a => a.entityId === n.id);
      if (i >= 0) audit.splice(i, 1);
      log(who(), "transfer", "Enrolment", n.id, at);
    }
  }

  // Follow-up calls about swimmers waiting for a place.
  const waiting = places.filter(p => p.status === "WAITLISTED");
  const outcomes = ["CONTACTED", "NO_REPLY", "PARENT_NOT_READY", "NO_SUITABLE_CLASS", "AWAITING_PARENT", "READY_TO_ENROL"];
  for (const [i, p] of waiting.entries()) {
    for (let n = 0; n < 1 + (i % 3); n++) {
      const by = who(), at = atDesk(new Date(now - (5 + random() * 80) * DAY));
      const outcome = pick(outcomes);
      await db.studentFollowUp.create({ data: {
        studentId: p.studentId, operationId: randomUUID(), actorId: by.id, actorName: by.name, clubId: HILLVIEW, clubName: "Hillview",
        channel: random() < 0.7 ? "PHONE" : pick(["EMAIL", "SMS", "IN_PERSON"]), outcome, note: "Synthetic follow-up.",
        occurredOn: new Date(at.toISOString().slice(0, 10)), nextContactOn: outcome === "READY_TO_ENROL" ? null : new Date(at.getTime() + (7 + random() * 21) * DAY), createdAt: at,
      } });
      log(by, "enrolment-follow-up", "Student", p.studentId, at);
    }
  }

  // Assessment bookings: most made at the desk, a few by parents in the app.
  const bookings = await db.assessmentBooking.findMany({ where: { session: { clubId: HILLVIEW } }, select: { id: true, session: { select: { date: true } } } });
  for (const b of bookings) {
    const at = atDesk(new Date(b.session.date.getTime() - (2 + random() * 10) * DAY));
    if (random() < 0.15) { await db.assessmentBooking.update({ where: { id: b.id }, data: { bookedById: null, bookedByName: "Parent app", createdAt: at } }); continue; }
    const by = who();
    await db.assessmentBooking.update({ where: { id: b.id }, data: { bookedById: by.id, bookedByName: by.name, createdAt: at } });
    log(by, "book", "AssessmentBooking", b.id, at);
  }

  // Cancelled classes: billing told within hours by most, days later by some.
  const cancelled = await db.classCancellation.findMany({ where: { clubId: HILLVIEW }, select: { id: true, date: true } });
  for (const k of cancelled) {
    const at = atDesk(new Date(k.date.getTime() - DAY));
    const by = who(), told = later(at, 0.5 + random() * by.pace * 2.5);
    await db.classCancellation.update({ where: { id: k.id }, data: { cancelledAt: at, billingNotifiedAt: told, billingNotifiedById: by.id, billingNotifiedByName: by.name } });
    log(by, "billing-notified", "Course", k.id, told);
  }

  // Parent app requests: detail changes and requests to see a child, answered at each person's pace.
  const parent = await db.parentAccount.findFirst({ where: { email: "pat.example@example.test" } });
  if (parent) {
    const kids = await db.student.findMany({ where: { clubId: HILLVIEW, enrolments: { some: { status: "ACTIVE" } } }, select: { id: true, firstName: true, lastName: true, dateOfBirth: true }, take: 40 });
    for (const [i, kid] of kids.entries()) {
      const arrived = new Date(now - (2 + random() * 110) * DAY);
      const by = who(), answered = later(arrived, 0.3 + random() * by.pace * 2);
      const open = i < 2;
      if (i % 2 === 0) {
        const r = await db.parentChangeRequest.create({ data: {
          parentId: parent.id, studentId: kid.id, key: randomUUID(), requestHash: randomUUID(), status: open ? "PENDING" : "APPLIED", proposed: { contactPhone: "000 000 0002" },
          message: "Synthetic request.", createdAt: arrived, ...(open ? {} : { reviewedById: by.id, reviewedByName: by.name, reviewedAt: answered }),
        } });
        if (!open) log(by, "apply-parent-change", "Student", kid.id, answered);
        void r;
      } else {
        const r = await db.parentAccessRequest.create({ data: {
          parentId: parent.id, key: randomUUID(), requestHash: randomUUID(), childFingerprint: randomUUID(), firstName: kid.firstName, lastName: kid.lastName,
          dateOfBirth: kid.dateOfBirth ?? new Date("2018-01-01T00:00:00Z"), context: "Synthetic request.", status: open ? "PENDING" : "APPROVED", createdAt: arrived,
          ...(open ? {} : { studentId: kid.id, reviewedById: by.id, reviewedByName: by.name, reviewedAt: answered }),
        } });
        if (!open) log(by, "approve", "ParentAccessRequest", r.id, answered, null);
      }
    }
  }

  // Academy places held online, called back within 72 hours or not.
  const online = await db.academyCourse.findFirst({ where: { note: "Synthetic online course for the sandbox." } });
  if (online) {
    for (let i = 0; i < 9; i++) {
      const held = new Date(now - (4 + i * 9) * DAY);
      const c = await db.academyCandidate.create({ data: { courseId: online.id, name: `Sam ${["Sample", "Demo", "Pretend"][i % 3]} ${i + 1}`, email: `held${i}@example.invalid`, payment: "paid", paidCents: 39500,
        callBy: new Date(held.getTime() + 72 * HOUR), createdAt: held, createdById: null, createdByName: "Online booking" } });
      const by = who(), call = later(held, 2 + random() * by.pace * 5);
      await db.academyCall.create({ data: { candidateId: c.id, outcome: "paid", amountCents: 39500, receipt: `SBX-${i}`, byId: by.id, byName: by.name, createdAt: call } });
      log(by, "call", "AcademyCall", c.id, call, HILLVIEW, "Short courses");
    }
  }

  for (let i = 0; i < audit.length; i += 500) await db.auditLog.createMany({ data: audit.slice(i, i + 500).map(a => ({ ...a, summary: `Sandbox: ${a.action} ${a.entity}` })) });
  console.log(`[sandbox] Reception history: ${audit.length} logged actions by ${desk.length} receptionists.`);
}
