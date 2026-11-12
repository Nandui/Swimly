import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

type Move = typeof import("@/modules/activities/features/together/server/move");

/** A made-up club: classes "a" (one place left) and "b", Robin in "old". */
function world({ earned = true } = {}) {
  const audits: { action: string; summary: string }[] = [];
  const writes: string[] = [];
  const course = (id: string, capacity: number) => ({ id, clubId: "club", name: null, dayOfWeek: "MONDAY", startMinutes: 960, capacity, archivedAt: null,
    levelId: "seals", level: { id: "seals", name: "Seals", archivedAt: null, programmeId: "p", programme: { archivedAt: null } } });
  const courses: Record<string, ReturnType<typeof course>> = { a: course("a", 4), b: course("b", 8), old: course("old", 8) };
  const taken: Record<string, number> = { a: 3, b: 0, old: 1 };
  const tx = {
    $queryRaw: async () => [],
    student: { findUnique: async ({ where }: { where: { id: string } }) => ({ firstName: where.id, lastName: "Sample", status: "ACTIVE" }) },
    course: { findUnique: async ({ where }: { where: { id: string } }) => courses[where.id] ?? null },
    enrolment: {
      findUnique: async ({ where }: { where: { id: string } }) => where.id === "e-old"
        ? { id: "e-old", studentId: "Robin", status: "ACTIVE", programmeId: "p", legendAgreementStatus: "DONE", legendAgreementUpdatedAt: null,
          legendAgreementUpdatedById: null, legendAgreementUpdatedByName: null, course: courses.old }
        : null,
      findFirst: async () => null,
      count: async ({ where }: { where: { courseId: string } }) => taken[where.courseId],
      update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => { writes.push(`${where.id} ${data.status}`); },
      create: async ({ data }: { data: { studentId: string; courseId: string } }) => {
        taken[data.courseId]++;
        writes.push(`${data.studentId} into ${data.courseId}`);
        return { id: `new-${data.studentId}` };
      },
    },
  };
  const move = serverModule<Move>("src/modules/activities/features/together/server/move.ts", {
    "@/lib/directory": { isArchivedSite: async () => false },
    "@/lib/audit": { logAudit: async (entry: { action: string; summary: string }) => { audits.push(entry); } },
    "@/modules/activities/shared/curriculum/data/shared": { readSharedCurriculum: async () => ({}), sharedCourse: <T>(c: T) => c },
    "@/modules/activities/shared/enrolment/rules": {
      COURSE_SELECT: {}, assessedElsewhere: async () => null,
      placementFor: async () => ({ earned, below: earned ? null : { name: "Otters" } }),
    },
  });
  return { move, tx: tx as never, audits, writes };
}

const session = { user: { id: "u", name: "Made-up Manager" } };

test("checking counts the places earlier children take, and changes nothing", async () => {
  const { move, tx, writes } = world();
  const checks = await move.runMove(tx, [
    { studentId: "Robin", toCourseId: "a", fromEnrolmentId: null },
    { studentId: "Poppy", toCourseId: "a", fromEnrolmentId: null },
  ]);
  assert.equal(checks[0].problem, null);
  assert.match(checks[1].problem ?? "", /now full/);
  assert.deepEqual(writes, []);
});

test("moving from a place ends it as transferred and logs the move from Together", async () => {
  const { move, tx, audits, writes } = world();
  await move.runMove(tx, [
    { studentId: "Robin", toCourseId: "b", fromEnrolmentId: "e-old" },
    { studentId: "Poppy", toCourseId: "b", fromEnrolmentId: null, legendAgreement: "PENDING" },
  ], session);
  assert.deepEqual(writes, ["e-old TRANSFERRED", "Robin into b", "Poppy into b"]);
  assert.deepEqual(audits.map((a) => a.action), ["transfer", "enrol"]);
  assert.match(audits[0].summary, /from Together/);
  assert.match(audits[1].summary, /Legend agreement: Still to do/);
});

test("a new place needs the Legend answer, and a level not earned needs a reason", async () => {
  const { move, tx } = world();
  await assert.rejects(move.runMove(tx, [{ studentId: "Poppy", toCourseId: "b", fromEnrolmentId: null }], session),
    (error: InstanceType<Move["MoveRefused"]>) => Boolean(error.fieldErrors?.["legend-Poppy"]));
  const notEarned = world({ earned: false });
  await assert.rejects(notEarned.move.runMove(notEarned.tx, [{ studentId: "Robin", toCourseId: "b", fromEnrolmentId: "e-old" }], session),
    (error: InstanceType<Move["MoveRefused"]>) => Boolean(error.fieldErrors?.["reason-Robin"]));
});

test("a class that filled up refuses the whole move", async () => {
  const { move, tx } = world();
  await assert.rejects(move.runMove(tx, [
    { studentId: "Robin", toCourseId: "a", fromEnrolmentId: "e-old" },
    { studentId: "Poppy", toCourseId: "a", fromEnrolmentId: null, legendAgreement: "DONE" },
  ], session), /now full.*Nothing has changed/);
});
