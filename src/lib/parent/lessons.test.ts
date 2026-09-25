import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "../../test/pglite-prisma";
import { childLessons } from "./lessons";

let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
before(async () => {
  fixture = await isolatedPrisma();
  await fixture.prisma.user.create({ data: { id: "lesson-teacher", name: "Alex Example", email: "teacher@example.test", passwordHash: "unused" } });
});
after(async () => fixture?.close());
const now = new Date("2026-09-14T14:45:00Z");
let familyCount = 0;
async function family() {
  const db = fixture.prisma;
  const programme = await db.programme.create({ data: { clubId: "club_bishopstown", name: `Example swimming ${++familyCount}` } });
  const level = await db.level.create({ data: { programmeId: programme.id, name: "Turtles" } });
  const course = await db.course.create({ data: { levelId: level.id, clubId: "club_bishopstown", dayOfWeek: "MONDAY", startMinutes: 960,
    durationMinutes: 30, location: "Learner pool", instructorId: "lesson-teacher" } });
  const child = await db.student.create({ data: { clubId: "club_bishopstown", firstName: "Avery", lastName: "Example", medicalNotes: "private medical note" } });
  const parent = await db.parentAccount.create({ data: { email: `${child.id}@example.test`, name: "Example Parent" } });
  const access = await db.parentChildAccess.create({ data: { studentId: child.id, parentEmail: parent.email, source: "STAFF_APPROVAL" } });
  const enrolment = await db.enrolment.create({ data: { studentId: child.id, courseId: course.id, levelId: level.id,
    programmeId: programme.id, startedOn: new Date("2026-01-01") } });
  return { db, child, parent, course, level, programme, enrolment, access };
}
async function cancel(f: Awaited<ReturnType<typeof family>>, date: string) {
  return f.db.classCancellation.create({ data: { courseId: f.course.id, clubId: f.course.clubId, date: new Date(date), className: "Turtles",
    levelName: "Turtles", programmeName: "Example swimming", startMinutes: 960, durationMinutes: 30, reason: "private reason",
    cancelledById: "lesson-teacher", cancelledByName: "Private staff attribution",
    swimmers: { create: { studentId: f.child.id, swimmerName: "Avery Example" } } } });
}

test("lesson reads require the current guardian link and expose no private staff or swimmer fields", async () => {
  const f = await family();
  await assert.rejects(childLessons(f.db, { ...f.parent, email: "unrelated@example.test" }, f.child.id, now), { status: 404 });
  const data = await childLessons(f.db, f.parent, f.child.id, now);
  assert.equal(data.nextLesson?.location, "Learner pool");
  const encoded = JSON.stringify(data);
  for (const value of ["private", "teacher@example.test", "medicalNotes", "markedBy", "placementReason", "parentEmail"]) assert.equal(encoded.includes(value), false);
  await f.db.parentChildAccess.update({ where: { id: f.access.id }, data: { revokedAt: now } });
  await assert.rejects(childLessons(f.db, f.parent, f.child.id, now), { status: 404 });
});

test("next lesson follows Dublin time, live teaching cover and the end of the current occurrence", async () => {
  const f = await family();
  await f.db.classCover.create({ data: { courseId: f.course.id, date: new Date("2026-09-14"), coverByName: "Robin Example", instructorName: "Alex Example" } });
  const data = await childLessons(f.db, f.parent, f.child.id, now);
  assert.equal(data.nextLesson?.startsAt, "2026-09-14T15:00:00.000Z");
  assert.equal(data.nextLesson?.instructorName, "Robin Example");
  assert.equal((await childLessons(f.db, f.parent, f.child.id, new Date("2026-09-14T15:10:00Z"))).nextLesson?.date, "2026-09-14");
  const after = await childLessons(f.db, f.parent, f.child.id, new Date("2026-09-14T15:30:00Z"));
  assert.equal(after.nextLesson?.date, "2026-09-21");
  assert.equal(after.nextLesson?.instructorName, "Alex Example");
});

test("cancelled occurrences are skipped and the earliest enrolled class can be at the other site", async () => {
  const f = await family();
  await cancel(f, "2026-09-14");
  const second = await f.db.course.create({ data: { clubId: "club_churchfield", levelId: f.level.id, dayOfWeek: "TUESDAY", startMinutes: 900, durationMinutes: 45 } });
  await f.db.enrolment.create({ data: { studentId: f.child.id, courseId: second.id, levelId: f.level.id, programmeId: f.programme.id, startedOn: new Date("2026-09-15") } });
  let result = await childLessons(f.db, f.parent, f.child.id, now);
  assert.equal(result.nextLesson?.site.id, "club_churchfield");
  assert.equal(result.nextLesson?.date, "2026-09-15");
  assert.equal(result.nextLesson?.instructorName, null);
  assert.equal(result.upcomingCancellations[0]?.date, "2026-09-14");
  await f.db.course.update({ where: { id: second.id }, data: { archivedAt: now } });
  result = await childLessons(f.db, f.parent, f.child.id, now);
  assert.equal(result.nextLesson?.date, "2026-09-21");
});

test("future starts, exclusive end dates, ended enrolments and inactive swimmers limit the timetable", async () => {
  const f = await family();
  await f.db.enrolment.update({ where: { id: f.enrolment.id }, data: { startedOn: new Date("2026-09-22") } });
  assert.equal((await childLessons(f.db, f.parent, f.child.id, now)).nextLesson?.date, "2026-09-28");
  await f.db.enrolment.update({ where: { id: f.enrolment.id }, data: { scheduledEndOn: new Date("2026-09-28") } });
  assert.equal((await childLessons(f.db, f.parent, f.child.id, now)).nextLesson, null);
  await f.db.enrolment.update({ where: { id: f.enrolment.id }, data: { scheduledEndOn: null, endedOn: new Date("2026-09-28") } });
  assert.equal((await childLessons(f.db, f.parent, f.child.id, now)).nextLesson, null);
  await f.db.enrolment.update({ where: { id: f.enrolment.id }, data: { endedOn: null } });
  await f.db.student.update({ where: { id: f.child.id }, data: { status: "INACTIVE" } });
  assert.equal((await childLessons(f.db, f.parent, f.child.id, now)).nextLesson, null);
});

test("attendance counts saved completed lessons only, includes late arrivals and excludes cancellations", async () => {
  const f = await family();
  for (const [date, status] of [["2026-09-07", "PRESENT"], ["2026-08-31", "ABSENT"], ["2026-08-24", "LATE"], ["2026-08-17", "ABSENT"],
    ["2026-09-14", "PRESENT"], ["2026-05-04", "ABSENT"]] as const) {
    await f.db.attendanceRecord.create({ data: { courseId: f.course.id, studentId: f.child.id, date: new Date(date), status, note: "private attendance note", markedByName: "Private staff attribution" } });
  }
  await cancel(f, "2026-08-17");
  await cancel(f, "2026-08-10");
  const result = await childLessons(f.db, f.parent, f.child.id, now);
  assert.deepEqual({ ...result.attendance, history: undefined }, {
    from: "2026-06-23", to: "2026-09-14", present: 1, late: 1, absent: 1, attended: 2, recorded: 3, rate: 67, cancelled: 2, history: undefined,
  });
  assert.equal(result.attendance.history.length, 5);
  assert.equal(JSON.stringify(result).includes("private"), false);
  assert.equal((await childLessons(f.db, f.parent, f.child.id, new Date("2026-09-14T15:30:00Z"))).attendance.recorded, 4);
});

test("no marks means no percentage; a saved absence is zero percent, never an inferred absence", async () => {
  const f = await family();
  assert.equal((await childLessons(f.db, f.parent, f.child.id, now)).attendance.rate, null);
  await f.db.attendanceRecord.create({ data: { courseId: f.course.id, studentId: f.child.id, date: new Date("2026-09-07"), status: "ABSENT", markedByName: "Example" } });
  assert.equal((await childLessons(f.db, f.parent, f.child.id, now)).attendance.rate, 0);
});

test("assessment-only and waiting-list children are distinct from current, future and former weekly swimmers", async () => {
  const f = await family();
  assert.equal((await childLessons(f.db, f.parent, f.child.id, now)).hasEnrolment, true);
  await f.db.enrolment.update({ where: { id: f.enrolment.id }, data: { status: "WAITLISTED" } });
  assert.equal((await childLessons(f.db, f.parent, f.child.id, now)).hasEnrolment, false);
  await f.db.enrolment.delete({ where: { id: f.enrolment.id } });
  assert.equal((await childLessons(f.db, f.parent, f.child.id, now)).hasEnrolment, false);
  await f.db.enrolment.create({ data: { studentId: f.child.id, courseId: f.course.id, levelId: f.level.id,
    programmeId: f.programme.id, startedOn: new Date("2025-01-01"), endedOn: new Date("2025-02-01"), status: "WITHDRAWN" } });
  await f.db.student.update({ where: { id: f.child.id }, data: { status: "INACTIVE" } });
  await f.db.course.update({ where: { id: f.course.id }, data: { archivedAt: now } });
  const former = await childLessons(f.db, f.parent, f.child.id, now);
  assert.equal(former.nextLesson, null);
  assert.equal(former.attendance.recorded, 0);
  assert.equal(former.hasEnrolment, true, "old or archived lessons must not turn into an assessment-only page");
});

test("weekly lesson times handle Dublin daylight-saving boundaries", async () => {
  const f = await family();
  await f.db.course.update({ where: { id: f.course.id }, data: { dayOfWeek: "SUNDAY", startMinutes: 90 } });
  const autumn = await childLessons(f.db, f.parent, f.child.id, new Date("2026-10-24T12:00:00Z"));
  assert.equal(autumn.nextLesson?.startsAt, "2026-10-25T00:30:00.000Z");
  const spring = await childLessons(f.db, f.parent, f.child.id, new Date("2026-03-28T12:00:00Z"));
  assert.equal(spring.nextLesson?.startsAt, "2026-04-05T00:30:00.000Z");
});
