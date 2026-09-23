import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import type { AssessmentBookingStatus, EnrolmentStatus } from "@/generated/prisma/client";

let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let read: typeof import("./awaiting-enrolment").getAwaitingEnrolment;
const state = { clubId: "club_bishopstown", authenticated: true };
const date = (iso: string) => new Date(`${iso}T00:00:00Z`);

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.programme.create({ data: { id: "follow-programme", clubId: "club_bishopstown", name: "Synthetic swimming" } });
  await db.programme.create({ data: { id: "follow-copy", clubId: "club_churchfield", name: "Synthetic site copy", sharedWithId: "follow-programme" } });
  await db.programme.create({ data: { id: "follow-other", clubId: "club_bishopstown", name: "Synthetic lifesaving" } });
  await db.level.create({ data: { id: "follow-level", programmeId: "follow-programme", name: "Turtles" } });
  await db.level.create({ data: { id: "follow-level-copy", programmeId: "follow-copy", name: "Old Turtles", sharedWithId: "follow-level" } });
  await db.level.create({ data: { id: "follow-higher", programmeId: "follow-programme", name: "Dolphins", sortOrder: 2 } });
  await db.level.create({ data: { id: "follow-other-level", programmeId: "follow-other", name: "Rookies" } });
  for (const [id, clubId, levelId] of [["follow-course", "club_bishopstown", "follow-level"], ["follow-second", "club_bishopstown", "follow-level"], ["follow-cross-site", "club_churchfield", "follow-level-copy"], ["follow-other-course", "club_bishopstown", "follow-other-level"]]) {
    await db.course.create({ data: { id, clubId, levelId, dayOfWeek: "MONDAY", startMinutes: 900, durationMinutes: 30 } });
  }
  read = serverModule<typeof import("./awaiting-enrolment")>("src/lib/enrolment/data/awaiting-enrolment.ts", {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": { requireSession: async () => { if (!state.authenticated) throw Error("Sign in required"); } },
    "@/lib/clubs/current": { currentClubId: async () => state.clubId },
    react: { cache: (fn: unknown) => fn },
  }).getAwaitingEnrolment;
});
after(async () => { await fixture?.close(); });

async function swimmer(id: string, status: "ACTIVE" | "INACTIVE" = "ACTIVE") {
  await fixture.prisma.student.create({ data: { id, clubId: "club_bishopstown", firstName: id, lastName: "Example", memberNumber: `TEST-${id}`, status, medicalNotes: "Must not leave the database", contactEmail: "guardian@example.test" } });
}
async function placement(id: string, studentId: string, options: { clubId?: string; programmeId?: string; day?: string; levelId?: string | null; status?: AssessmentBookingStatus; cancelled?: boolean } = {}) {
  const day = date(options.day ?? "2026-09-01");
  await fixture.prisma.assessmentSession.create({ data: { id: `session-${id}`, clubId: options.clubId ?? "club_bishopstown", programmeId: options.programmeId ?? "follow-programme", date: day, startMinutes: 900, cancelledAt: options.cancelled ? new Date() : null } });
  await fixture.prisma.assessmentBooking.create({ data: { id, sessionId: `session-${id}`, studentId, status: options.status ?? "ATTENDED", outcomeLevelId: options.levelId === undefined ? "follow-level" : options.levelId, assessedOn: day, bookedByName: "Synthetic desk" } });
}
async function enrol(studentId: string, options: { status?: EnrolmentStatus; start?: string; end?: string; otherProgramme?: boolean; localCourse?: string } = {}) {
  return fixture.prisma.enrolment.create({ data: { studentId, courseId: options.localCourse ?? (options.otherProgramme ? "follow-other-course" : "follow-cross-site"), programmeId: options.localCourse ? "follow-programme" : options.otherProgramme ? "follow-other" : "follow-copy", levelId: options.localCourse ? "follow-level" : options.otherProgramme ? "follow-other-level" : "follow-level-copy", status: options.status ?? "ACTIVE", startedOn: date(options.start ?? "2026-09-10"), createdAt: date(options.start ?? "2026-09-10"), endedOn: options.end ? date(options.end) : null } });
}

test("requires a saved outcome and an active swimmer; completed placements survive session cancellation", async () => {
  for (const id of ["eligible", "unplaced", "no-show", "cancelled-booking", "inactive", "cancelled-session"]) await swimmer(id, id === "inactive" ? "INACTIVE" : "ACTIVE");
  await placement("eligible", "eligible");
  await placement("unplaced", "unplaced", { levelId: null, status: "BOOKED" });
  await placement("no-show", "no-show", { status: "NO_SHOW" });
  await placement("cancelled-booking", "cancelled-booking", { status: "CANCELLED" });
  await placement("inactive", "inactive");
  await placement("cancelled-session", "cancelled-session", { cancelled: true });
  const result = await read();
  assert.deepEqual(new Set(result.items.map(r => r.student.id)), new Set(["eligible", "cancelled-session"]));
  assert.equal("medicalNotes" in result.items[0].student, false);
});

test("only the latest shared-programme placement remains, owned by the site that assessed it", async () => {
  await swimmer("reassessed");
  await placement("repeat-old", "reassessed");
  await placement("repeat-new", "reassessed", { day: "2026-09-03", levelId: "follow-higher" });
  assert.deepEqual((await read({ q: "reassessed" })).items.map(r => r.id), ["repeat-new"]);
  await placement("repeat-other-site", "reassessed", { day: "2026-09-05", clubId: "club_churchfield", programmeId: "follow-copy", levelId: "follow-level-copy" });
  assert.equal((await read({ q: "reassessed" })).total, 0);
  state.clubId = "club_churchfield";
  try {
    const result = await read({ q: "reassessed" });
    assert.equal(result.total, 1);
    assert.equal(result.items[0].outcomeLevel?.name, "Turtles");
    assert.equal(result.items[0].programme.id, "follow-programme");
  } finally { state.clubId = "club_bishopstown"; }
});

test("waitlists remain; a future class place at the other site resolves the follow-up", async () => {
  await swimmer("waitlist-family");
  await placement("waitlist-placement", "waitlist-family");
  const row = await enrol("waitlist-family", { status: "WAITLISTED" });
  assert.equal((await read({ q: "waitlist-family" })).total, 1);
  await fixture.prisma.enrolment.update({ where: { id: row.id }, data: { status: "ACTIVE", startedOn: date("2027-01-01") } });
  assert.equal((await read({ q: "waitlist-family" })).total, 0);
});

test("an unrelated programme or an enrolment ended before assessment does not hide a pending swimmer", async () => {
  await swimmer("other-programme");
  await placement("other-placement", "other-programme");
  await enrol("other-programme", { otherProgramme: true });
  assert.equal((await read({ q: "other-programme" })).total, 1);
  await swimmer("returning-family");
  await placement("returning-placement", "returning-family");
  await enrol("returning-family", { status: "WITHDRAWN", start: "2026-01-01", end: "2026-08-01" });
  assert.equal((await read({ q: "returning-family" })).total, 1);
});

test("a completed enrolment follow-up does not reappear later when the swimmer leaves", async () => {
  await swimmer("resolved-family");
  await placement("resolved-placement", "resolved-family");
  await enrol("resolved-family", { status: "WITHDRAWN", start: "2026-09-02", end: "2026-09-10" });
  assert.equal((await read({ q: "resolved-family" })).total, 0);
});

test("withdrawing from an unfulfilled waitlist does not resolve the assessment", async () => {
  await swimmer("withdrawn-waitlist");
  await placement("withdrawn-waitlist-placement", "withdrawn-waitlist");
  const row = await enrol("withdrawn-waitlist", { status: "WITHDRAWN", start: "2026-09-02", end: "2026-09-10" });
  await fixture.prisma.auditLog.create({ data: { entity: "Enrolment", entityId: row.id, action: "waitlist", actorName: "Synthetic desk", summary: "Joined a synthetic waitlist" } });
  assert.equal((await read({ q: "withdrawn-waitlist" })).total, 1);
  await fixture.prisma.auditLog.create({ data: { entity: "Enrolment", entityId: row.id, action: "enrol", actorName: "Synthetic desk", summary: "Received a synthetic class place" } });
  assert.equal((await read({ q: "withdrawn-waitlist" })).total, 0);
});

test("search combines name tokens, supports member numbers and returns stable bounded pages", async () => {
  for (let i = 0; i < 22; i++) {
    const id = `pagination-${String(i).padStart(2, "0")}`;
    await swimmer(id);
    await placement(`placement-${id}`, id);
  }
  const first = await read({ q: "pagination example" });
  const second = await read({ q: "pagination example", page: 999 });
  assert.equal(first.total, 22); assert.equal(first.items.length, 20);
  assert.equal(second.page, 2); assert.equal(second.items.length, 2);
  assert.equal(new Set([...first.items, ...second.items].map(r => r.id)).size, 22);
  assert.equal((await read({ q: "TEST-pagination-07" })).total, 1);
  assert.equal((await read({ q: "not a matching swimmer", page: -3 })).page, 1);
});

test("authentication is checked before any record or curriculum reads", async () => {
  const count = fixture.queries.length;
  state.authenticated = false;
  try { await assert.rejects(read(), /Sign in required/); }
  finally { state.authenticated = true; }
  assert.equal(fixture.queries.length, count);
});

test("waitlists need no assessment and follow the course site, not the swimmer's home", async () => {
  await swimmer("unassessed-waiter");
  const waiting = await enrol("unassessed-waiter", { status: "WAITLISTED" });
  assert.equal((await read({ q: "unassessed-waiter" })).total, 0);
  state.clubId = "club_churchfield";
  try {
    const result = await read({ q: "TEST-unassessed-waiter" });
    assert.equal(result.total, 1);
    assert.equal(result.items[0].assessedOn, null);
    assert.equal(result.items[0].outcomeLevel, null);
    assert.equal(result.items[0].session, null);
    assert.deepEqual(result.items[0].waitlists.map(row => row.id), [waiting.id]);
    assert.equal(result.items[0].waitlists[0].course.level.name, "Turtles");
    assert.equal(result.items[0].programme.id, "follow-programme");
    assert.equal("medicalNotes" in result.items[0].student, false);
  } finally { state.clubId = "club_bishopstown"; }
});

test("assessment and multiple class waitlists group once without losing requests", async () => {
  await swimmer("combined-waiter");
  await placement("combined-placement", "combined-waiter");
  const first = await enrol("combined-waiter", { status: "WAITLISTED", localCourse: "follow-course", start: "2026-08-20" });
  const second = await enrol("combined-waiter", { status: "WAITLISTED", localCourse: "follow-second" });
  const result = await read({ q: "combined-waiter" });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, "combined-placement");
  assert.equal(result.items[0].outcomeLevel?.name, "Turtles");
  assert.deepEqual(result.items[0].waitlists.map(row => row.id), [first.id, second.id]);
  assert.equal(result.items[0].queuedOn.toISOString(), date("2026-08-20").toISOString());
});

test("a class place resolves assessment follow-up but never hides another outstanding waitlist", async () => {
  await swimmer("already-enrolled-waiter");
  await placement("already-enrolled-placement", "already-enrolled-waiter");
  const first = await enrol("already-enrolled-waiter", { status: "WAITLISTED", localCourse: "follow-course" });
  const second = await enrol("already-enrolled-waiter", { status: "WAITLISTED", localCourse: "follow-second" });
  await enrol("already-enrolled-waiter");
  let result = await read({ q: "already-enrolled-waiter" });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].outcomeLevel, null);
  assert.equal(result.items[0].waitlists.length, 2);
  await fixture.prisma.enrolment.update({ where: { id: first.id }, data: { status: "ACTIVE" } });
  result = await read({ q: "already-enrolled-waiter" });
  assert.deepEqual(result.items[0].waitlists.map(row => row.id), [second.id]);
  await fixture.prisma.enrolment.update({ where: { id: second.id }, data: { status: "WITHDRAWN" } });
  assert.equal((await read({ q: "already-enrolled-waiter" })).total, 0);
});

test("inactive swimmers are excluded while archived class waitlists remain visible for follow-up", async () => {
  await swimmer("inactive-waiter", "INACTIVE");
  await enrol("inactive-waiter", { status: "WAITLISTED", localCourse: "follow-course" });
  assert.equal((await read({ q: "inactive-waiter" })).total, 0);
  await swimmer("archived-class-waiter");
  await enrol("archived-class-waiter", { status: "WAITLISTED", localCourse: "follow-course" });
  await fixture.prisma.course.update({ where: { id: "follow-course" }, data: { archivedAt: date("2026-09-15") } });
  const result = await read({ q: "archived-class-waiter" });
  assert.equal(result.total, 1);
  assert.ok(result.items[0].waitlists[0].course.archivedAt);
});

test("each swimmer carries their latest shared follow-up without resolving assessments or waitlists", async () => {
  await swimmer("contact-history");
  await placement("contact-placement", "contact-history");
  const waiting = await enrol("contact-history", { status: "WAITLISTED", localCourse: "follow-second" });
  for (const [operationId, outcome, clubId] of [["first-contact", "NO_REPLY", "club_bishopstown"], ["next-contact", "PARENT_NOT_READY", "club_churchfield"]]) {
    await fixture.prisma.studentFollowUp.create({ data: {
      studentId: "contact-history", operationId, actorId: "example-reception", actorName: "Example receptionist",
      clubId, clubName: "Example site", channel: "PHONE", outcome, note: "A synthetic follow-up note.",
      occurredOn: date("2026-09-03"), nextContactOn: date("2026-10-01"),
    } });
  }
  const result = await read({ q: "contact-history" });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].outcomeLevel?.name, "Turtles");
  assert.deepEqual(result.items[0].waitlists.map(row => row.id), [waiting.id]);
  assert.equal(result.items[0].followUp.count, 2);
  assert.equal(result.items[0].followUp.latest?.outcome, "PARENT_NOT_READY");
  assert.equal(result.items[0].followUp.latest?.nextContactOn, "2026-10-01");
  assert.equal(result.items[0].followUp.latest?.actorName, "Example receptionist");
  assert.equal("operationId" in result.items[0].followUp.latest!, false);
  assert.equal("enrolmentFollowUps" in result.items[0].student, false);
});
