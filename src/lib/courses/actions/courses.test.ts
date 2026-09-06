import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

type Actions = typeof import("./courses");
const input: import("./courses").CourseInput = {
  levelId: "entry", name: "Test class", dayOfWeek: "MONDAY", startTime: "15:00",
  durationMinutes: 30, capacity: "8", instructorId: "", location: "",
};

function fixture() {
  const course = {
    id: "class", clubId: "club", name: "Test class", levelId: "entry", dayOfWeek: "MONDAY",
    startMinutes: 900, durationMinutes: 30, capacity: 8, instructorId: null, location: null,
    archivedAt: null, level: { name: "Entry", programmeId: "programme" }, _count: { enrolments: 0 },
  };
  const level = { id: "entry", name: "Entry", archivedAt: null, programmeId: "programme", programme: { clubId: "club", archivedAt: null } };
  let open = 0;
  let writes = 0;
  let locked = false;
  const tx = {
    $queryRaw: async () => { locked = true; return []; },
    course: {
      findUnique: async ({ where }: { where: { clubId: string } }) => {
        assert.ok(locked); return where.clubId === course.clubId ? course : null;
      },
      update: async ({ data }: { data: object }) => { writes++; return { ...course, ...data }; },
    },
    level: { findUnique: async ({ where }: { where: { programme: { clubId: string } } }) => where.programme.clubId === level.programme.clubId ? level : null },
    enrolment: { count: async () => open },
    auditLog: { create: async () => {} },
  };
  const prisma = { ...tx, $transaction: async (run: (db: typeof tx) => Promise<unknown>) => run(tx) };
  const actions = serverModule<Actions>("src/lib/courses/actions/courses.ts", {
    "@/lib/prisma": { prisma },
    "@/lib/authz": { requirePermission: async () => ({ user: { id: "staff", name: "Test Staff" } }) },
    "@/lib/clubs/current": { currentClubId: async () => "club", currentClubIdIfAny: async () => "club" },
    "next/cache": { revalidatePath: () => {} },
  });
  return { actions, course, level, writes: () => writes, waitlist: () => { open = 1; } };
}

test("changing a class level refuses another club's curriculum", async () => {
  const f = fixture(); f.level.programme.clubId = "other";
  assert.equal((await f.actions.updateCourse("class", { ...input, levelId: "other-level" })).ok, false);
  assert.equal(f.writes(), 0);
});

test("a waitlist pins the level of a class even when no active place is taken", async () => {
  const f = fixture(); f.waitlist();
  assert.equal((await f.actions.updateCourse("class", { ...input, levelId: "next" })).ok, false);
  assert.equal(f.writes(), 0);
});

test("archiving a class refuses outstanding enrolments or waitlist places", async () => {
  const f = fixture(); f.course._count.enrolments = 1;
  assert.equal((await f.actions.setCourseArchived("class", true)).ok, false);
  assert.equal(f.writes(), 0);
});

test("re-submitting an unchanged class makes no mutation", async () => {
  const f = fixture();
  assert.equal((await f.actions.updateCourse("class", input)).ok, true);
  assert.equal(f.writes(), 0);
});
