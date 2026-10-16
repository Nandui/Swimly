import assert from "node:assert/strict";
import { test } from "node:test";
import type { AuditEventRow, AuditWorkRow } from "@/lib/audit";
import type { JobRow } from "@/modules/activities/features/analytics/server/desk-queries";
import {
  buildDesk, buildDeskPerson, corrections, jobsFromRows, summariseJobs, waitlistJobs, workKind,
} from "@/modules/activities/features/analytics/server/desk";
import { reportPeriod } from "@/modules/activities/features/analytics/server/period";

const now = new Date("2026-10-16T12:00:00Z");
const period = reportPeriod("4w", now);
const event = (entityId: string, action: string, at: string, actorName = "Fiona Example", actorId = "u_fiona"): AuditEventRow =>
  ({ entityId, action, actorId, actorName, clubId: "a", at: new Date(at) });

test("only the desk's own work counts: teaching and set-up are left out", () => {
  assert.equal(workKind("Swim school", "Enrolment", "enrol"), "enrol");
  assert.equal(workKind("Swim school", "Enrolment", "transfer"), "move");
  assert.equal(workKind("Swim school", "Enrolment", "schedule-withdrawal"), "unenrol");
  assert.equal(workKind("Swim school", "Student", "enrolment-follow-up"), "followup");
  assert.equal(workKind("Swim school", "ParentAccessRequest", "approve"), "parent");
  assert.equal(workKind("Short courses", "AcademyCall", "call"), "academy");
  assert.equal(workKind("Refunds", "RefundRequest", "submit"), "refund");
  assert.equal(workKind("Swim school", "AttendanceRecord", "mark"), null);
  assert.equal(workKind("Swim school", "Level", "create"), null);
  assert.equal(workKind("Rota", "Shift", "create"), null);
});

test("timed jobs are measured against their target; open ones are late only once past it", () => {
  const rows: JobRow[] = [
    { kind: "parent.details", siteId: null, arrived: "2026-10-10 09:00:00", doneAt: "2026-10-10 15:00:00", doneById: "u_fiona", doneByName: "Fiona Example", open: false },
    { kind: "parent.details", siteId: null, arrived: "2026-10-11 09:00:00", doneAt: "2026-10-13 09:00:00", doneById: "u_hazel", doneByName: "Hazel Example", open: false },
    { kind: "parent.details", siteId: null, arrived: "2026-10-16 10:00:00", doneAt: null, doneById: null, doneByName: null, open: true },
    { kind: "billing.cancellation", siteId: "a", arrived: "2026-10-01 09:00:00", doneAt: null, doneById: null, doneByName: null, open: true },
  ];
  const jobs = jobsFromRows(rows, now);
  assert.deepEqual(jobs.map(j => [j.minutes, j.onTime, j.by?.name ?? null]), [[360, true, "Fiona Example"], [2880, false, "Hazel Example"], [120, null, null], [21_780, false, null]]);
  const summary = summariseJobs(jobs, period.start, period.end);
  const parent = summary.find(s => s.kind === "parent.details")!;
  assert.equal(parent.done, 2);
  assert.equal(parent.onTime, 50);
  assert.equal(parent.median, 1620);
  assert.equal(parent.open, 1);
  assert.equal(summary.find(s => s.kind === "billing.cancellation")!.overdue, 1);
});

test("a waiting list wait runs from joining it to the place, even when it began before the period", () => {
  const jobs = waitlistJobs([
    event("e1", "waitlist", "2026-07-01T10:00:00Z", "Gary Example", "u_gary"),
    event("e1", "enrol", "2026-10-06T10:00:00Z"),
    event("e2", "enrol", "2026-10-07T10:00:00Z"),
  ], period.start, period.end);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].by?.name, "Fiona Example");
  assert.equal(Math.round(jobs[0].minutes / 1440), 97);
});

test("a place unenrolled within a day counts against whoever made it", () => {
  const found = corrections([
    event("p1", "enrol", "2026-10-05T10:00:00Z", "Hazel Example", "u_hazel"),
    event("p1", "withdraw", "2026-10-05T13:00:00Z"),
    event("p2", "enrol", "2026-10-05T10:00:00Z"),
    event("p2", "withdraw", "2026-10-08T10:00:00Z"),
  ], period.start, period.end);
  assert.deepEqual(found.map(f => [f.name, f.hours]), [["Hazel Example", 3]]);
});

test("each person's work, share and record quality, and their page against the team", () => {
  const work: AuditWorkRow[] = [
    { actorId: "u_fiona", actorName: "Fiona Example", module: "Swim school", entity: "Enrolment", action: "enrol", clubId: "a", day: "2026-10-05", hour: 16, count: 6 },
    { actorId: "u_hazel", actorName: "Hazel Example", module: "Swim school", entity: "Enrolment", action: "enrol", clubId: "a", day: "2026-10-06", hour: 10, count: 2 },
    { actorId: "u_hazel", actorName: "Hazel Example", module: "Swim school", entity: "AttendanceRecord", action: "mark", clubId: "a", day: "2026-10-06", hour: 10, count: 40 },
    { actorId: "u_fiona", actorName: "Fiona Example", module: "Swim school", entity: "Enrolment", action: "enrol", clubId: "a", day: "2026-09-01", hour: 16, count: 3 },
  ];
  const added = (id: string, by: string, noPhone: boolean) => ({ event: event(id, "create", "2026-10-06T10:00:00Z", `${by} Example`, `u_${by.toLowerCase()}`), details: { id, noBirthday: false, noPhone, noEmergency: false } });
  const desk = buildDesk({
    period, work, jobs: jobsFromRows([{ kind: "parent.details", siteId: null, arrived: "2026-10-10 09:00:00", doneAt: "2026-10-10 10:00:00", doneById: "u_fiona", doneByName: "Fiona Example", open: false }], now),
    followUps: [], bookings: [],
    newSwimmers: [added("s1", "Hazel", true), added("s2", "Hazel", false), added("s3", "Fiona", false)],
    unenrols: [], placeEvents: [],
  });
  assert.equal(desk.total, 8);
  assert.equal(desk.previousTotal, 3);
  assert.deepEqual(desk.people.map(p => [p.name, p.actions, p.share, p.missingDetails]), [["Fiona Example", 6, 75, 0], ["Hazel Example", 2, 25, 50]]);
  assert.equal(desk.heat.find(r => r.hour === 16)!.cells[0].count, 6);
  const hazel = buildDeskPerson(desk, "staff:u_hazel", period, [])!;
  assert.equal(hazel.compare.missingDetails.mine, 50);
  assert.equal(Math.round(hazel.compare.missingDetails.team!), 33);
  assert.equal(buildDeskPerson(desk, "staff:nobody", period, []), null);
});
