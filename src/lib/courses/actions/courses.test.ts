import assert from "node:assert/strict";
import { test } from "node:test";
import { curriculumProgramme } from "@/test/curriculum";
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
  const audits: Record<string, unknown>[] = [];
  const created: Record<string, unknown>[] = [];
  const curriculum = curriculumProgramme("programme", ["entry", "next"]);
  const tx = {
    programme: { findMany: async () => [curriculum] },
    $queryRaw: async () => { locked = true; return []; },
    course: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        writes++; created.push(data); return { ...course, ...data };
      },
      findUnique: async ({ where }: { where: { id: string; clubId?: string } }) => {
        assert.ok(locked); return where.id === course.id && (!where.clubId || where.clubId === course.clubId) ? course : null;
      },
      update: async ({ data }: { data: object }) => { writes++; return { ...course, ...data }; },
    },
    level: { findUnique: async ({ where }: { where: { programme: { clubId: string } } }) => where.programme.clubId === level.programme.clubId ? level : null },
    enrolment: { count: async () => open },
    auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { audits.push(data); } },
  };
  const prisma = { ...tx, $transaction: async (run: (db: typeof tx) => Promise<unknown>) => run(tx) };
  const actions = serverModule<Actions>("src/lib/courses/actions/courses.ts", {
    "@/lib/prisma": { prisma },
    "@/lib/authz": { requirePermission: async () => ({ user: { id: "staff", name: "Test Staff" } }) },
    "@/lib/clubs/current": { currentClubId: async () => "club", currentClubIdIfAny: async () => "club" },
    "next/cache": { revalidatePath: () => {} },
  });
  return { actions, course, level, curriculum, audits, created, writes: () => writes, waitlist: () => { open = 1; } };
}

test("new classes belong to the working site even when their shared curriculum originated elsewhere", async () => {
  const f = fixture();
  f.curriculum.clubId = "other";
  assert.equal((await f.actions.createCourse(input)).ok, true);
  assert.equal(f.created[0].clubId, "club");
  assert.equal(f.created[0].levelId, "entry");
  assert.equal(f.audits[0].clubId, "club");
  assert.equal(f.audits[0].programmeId, "programme");
});

test("changing a class level refuses a missing curriculum definition", async () => {
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
