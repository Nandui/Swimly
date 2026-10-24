import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { addDaysIso, parseDateOnly, today } from "@/lib/format";

/** Training's plugs into the platform: the Training section of a person's file (what they
 *  have to do, what is overdue, how much they have done) and the three record sets HR's
 *  subject export gathers. Only that person's records, never anyone else's. Invented people. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let file: typeof import("../features/person-file/server/file");
const ORG = "org_leisureworld";

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["ava", "noah"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG } });
  const course = (title: string) => db.trainingCourse.create({ data: { orgId: ORG, title } });
  const [safeguarding, firstAid, manual, cpr] = await Promise.all([course("Synthetic safeguarding"), course("Synthetic first aid"), course("Synthetic manual handling"), course("Synthetic CPR")]);
  const assign = (courseId: string, userId: string, data: { status?: string; dueOn?: Date | null; completedAt?: Date } = {}) =>
    db.trainingAssignment.create({ data: { orgId: ORG, courseId, userId, assignedByName: "Maya", ...data } });
  await assign(safeguarding.id, "ava", { dueOn: parseDateOnly(addDaysIso(today(), -3)) });
  await assign(firstAid.id, "ava", { status: "SUBMITTED", dueOn: parseDateOnly(addDaysIso(today(), 7)) });
  await assign(manual.id, "ava", { status: "COMPLETED", completedAt: new Date() });
  await assign(cpr.id, "noah", { dueOn: null });
  await db.trainingHours.create({ data: { orgId: ORG, userId: "ava", on: parseDateOnly(today()), minutes: 45, topic: "Synthetic spinal board drill", recordedByName: "Maya" } });
  await db.trainingRefresherDay.create({ data: { userId: "ava", on: parseDateOnly(today()) } });
  file = serverModule("src/modules/training/features/person-file/server/file.ts", { "@/lib/prisma": { prisma: db }, "server-only": {} });
});
after(async () => { await fixture?.close(); });

test("the person's file lists what they have to do, overdue first, and counts what they have done", async () => {
  const ava = await file.trainingFile("ava");
  assert.equal(ava.summary, "2 to do · 1 overdue · 1 completed.");
  assert.deepEqual(ava.entries.map((e) => e.title), ["Synthetic safeguarding", "Synthetic first aid"], "the overdue one first; completed courses are not listed");
  assert.match(ava.entries[0].detail, /^Was due /);
  assert.match(ava.entries[1].detail, /^Waiting for sign-off · Due /);
  const noah = await file.trainingFile("noah");
  assert.equal(noah.summary, "1 to do · 0 completed.");
  assert.equal(noah.entries[0].detail, "No deadline");
  assert.equal((await file.trainingFile("nobody")).summary, "Nothing to do · 0 completed.");
});

test("HR's subject export gets every assignment, the on-the-job record and the learner's own space, for that person only", async () => {
  const records = await file.trainingRecords("ava");
  assert.deepEqual(records.map((r) => r.course.title).sort(), ["Synthetic first aid", "Synthetic manual handling", "Synthetic safeguarding"], "Noah's course is not Ava's");
  const onTheJob = await file.trainingOnTheJobRecords("ava");
  assert.deepEqual(onTheJob.hours.map((h) => [h.topic, h.minutes]), [["Synthetic spinal board drill", 45]]);
  assert.deepEqual([onTheJob.sessions, onTheJob.paths, onTheJob.evidence], [[], [], []]);
  assert.ok(onTheJob.evidence.every((e) => !("bytes" in e)), "photo evidence is listed by name, never sent");
  const learner = await file.trainingLearnerRecords("ava");
  assert.equal(learner.refresherDays.length, 1);
  assert.deepEqual([learner.notes, learner.feedback, learner.refresherCards], [[], [], []]);
  const noah = await file.trainingOnTheJobRecords("noah");
  assert.equal(noah.hours.length, 0);
});
