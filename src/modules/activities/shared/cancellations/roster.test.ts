import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { addDaysIso, today } from "@/lib/format";
import { syncCancelledRosters } from "@/modules/activities/shared/cancellations/roster";

let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
before(async () => { fixture = await isolatedPrisma(); });
after(async () => fixture?.close());

let classCount = 0;
async function setup() {
  const db = fixture.prisma;
  const programme = await db.programme.create({ data: { clubId: "club_bishopstown", name: `Example swimming ${++classCount}` } });
  const level = await db.level.create({ data: { programmeId: programme.id, name: "Turtles" } });
  const course = await db.course.create({ data: { levelId: level.id, clubId: "club_bishopstown", dayOfWeek: "MONDAY", startMinutes: 960, durationMinutes: 30 } });
  const swimmer = async (firstName: string, startedOn: string, extra: { scheduledEndOn?: Date } = {}) => {
    const student = await db.student.create({ data: { clubId: "club_bishopstown", firstName, lastName: "Example" } });
    const place = await db.enrolment.create({ data: { studentId: student.id, courseId: course.id, levelId: level.id, programmeId: programme.id, startedOn: new Date(startedOn), ...extra } });
    return { student, place };
  };
  const cancel = (date: string, swimmers: { id: string; name: string }[], billed = false) => db.classCancellation.create({ data: {
    courseId: course.id, clubId: course.clubId, date: new Date(date), className: "Turtles", levelName: "Turtles", programmeName: programme.name,
    startMinutes: 960, durationMinutes: 30, reason: "Synthetic gala", cancelledById: "manager", cancelledByName: "Example Manager",
    ...(billed ? { billingNotifiedAt: new Date() } : {}),
    swimmers: { create: swimmers.map(s => ({ studentId: s.id, swimmerName: s.name })) },
  } });
  const sync = () => db.$transaction(tx => syncCancelledRosters(tx, [course.id]));
  const names = async (id: string) => (await db.cancelledClassSwimmer.findMany({ where: { cancellationId: id }, orderBy: { swimmerName: "asc" } })).map(s => s.swimmerName);
  return { db, swimmer, cancel, sync, names };
}

test("an upcoming cancellation awaiting billing gains joiners and loses leavers", async () => {
  const f = await setup(), day = addDaysIso(today(), 14);
  const stays = await f.swimmer("Avery", "2026-01-01"), leaves = await f.swimmer("Blake", "2026-01-01");
  const cancellation = await f.cancel(day, [{ id: stays.student.id, name: "Avery Example" }, { id: leaves.student.id, name: "Blake Example" }]);
  await f.db.enrolment.update({ where: { id: leaves.place.id }, data: { scheduledEndOn: new Date(day) } }); // last lesson the week before
  await f.swimmer("Casey", today());
  await f.swimmer("Drew", addDaysIso(day, 1)); // starts after the cancelled day
  await f.sync();
  assert.deepEqual(await f.names(cancellation.id), ["Avery Example", "Casey Example"]);
  await f.sync(); // idempotent
  assert.deepEqual(await f.names(cancellation.id), ["Avery Example", "Casey Example"]);
});

test("once billing has acted, or the day has passed, the swimmer list is evidence and never changes", async () => {
  const f = await setup();
  const avery = await f.swimmer("Avery", "2026-01-01");
  const billed = await f.cancel(addDaysIso(today(), 7), [{ id: avery.student.id, name: "Avery Example" }], true);
  const past = await f.cancel(addDaysIso(today(), -7), [{ id: avery.student.id, name: "Avery Example" }]);
  await f.swimmer("Casey", addDaysIso(today(), -30));
  await f.db.enrolment.update({ where: { id: avery.place.id }, data: { status: "WITHDRAWN", endedOn: new Date(addDaysIso(today(), -14)) } });
  await f.sync();
  assert.deepEqual(await f.names(billed.id), ["Avery Example"]);
  assert.deepEqual(await f.names(past.id), ["Avery Example"]);
});
