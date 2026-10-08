import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";

/** The daily Turnfin Me digest: one email per person with only new items,
 *  never repeated, and nothing for a kind the person turned off. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let reminders: typeof import("./reminders");
const ORG = "org_leisureworld";
const originalEnv = { ...process.env };
const mail: { email: string; subject: string; line: string }[] = [];
const day = (offset: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + offset); return d; };

before(async () => {
  Object.assign(process.env, { STAFF_API_ENABLED: "true", STAFF_AUTH_SECRET: "synthetic-staff-secret-at-least-thirty-two-chars", STAFF_API_ALLOWED_ORIGINS: "https://me.example.test" });
  delete process.env.DOCS_DATABASE_URL;
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["ava", "riley", "noah"]) await db.user.create({ data: { id, name: id, email: `${id}@example.test`, staffRoleId: "r-staff", orgId: ORG } });
  await db.qualificationType.create({ data: { id: "qt-life", orgId: ORG, name: "Synthetic lifeguard" } });
  const course = await db.trainingCourse.create({ data: { orgId: ORG, title: "Synthetic safeguarding" } });
  await db.trainingAssignment.create({ data: { orgId: ORG, courseId: course.id, userId: "ava", assignedByName: "Maya", dueOn: day(1) } });
  await db.trainingAssignment.create({ data: { orgId: ORG, courseId: course.id, userId: "noah", assignedByName: "Maya", dueOn: day(-2) } });
  await db.qualification.create({ data: { orgId: ORG, userId: "ava", typeId: "qt-life", issuedOn: day(-700), expiresOn: day(10) } });
  // Riley's expiring certificate has been renewed: no reminder.
  await db.qualification.create({ data: { orgId: ORG, userId: "riley", typeId: "qt-life", issuedOn: day(-700), expiresOn: day(5) } });
  await db.qualification.create({ data: { orgId: ORG, userId: "riley", typeId: "qt-life", issuedOn: day(-1), expiresOn: day(700) } });
  // Noah turned training reminders off.
  await db.staffNotificationPreference.create({ data: { userId: "noah", trainingDue: false } });
  reminders = serverModule("src/lib/staff-api/reminders.ts", {
    "@/lib/prisma": { prisma: db },
    "@/lib/staff-api/email": { sendStaffReminder: async (email: string, subject: string, line: string) => { mail.push({ email, subject, line }); } },
  });
});
after(async () => { process.env = originalEnv; await fixture?.close(); });

test("one digest per person, only new items, preferences respected, renewals ignored", async () => {
  const first = await reminders.runReminders();
  assert.equal(first.sent, 1);
  assert.deepEqual(mail.map((m) => m.email), ["ava@example.test"]);
  assert.match(mail[0].line, /Synthetic safeguarding is due/);
  assert.match(mail[0].line, /Synthetic lifeguard expires/);
  assert.equal(mail[0].subject, "2 things need you in Turnfin Me");
  const again = await reminders.runReminders();
  assert.equal(again.sent, 0, "never the same reminder twice");
});

test("nothing is sent while Turnfin Me is off", async () => {
  process.env.STAFF_API_ENABLED = "false";
  try { assert.equal((await reminders.runReminders()).sent, 0); } finally { process.env.STAFF_API_ENABLED = "true"; }
});

test("a line manager hears about their team's expiring qualifications, once", async () => {
  const db = fixture.prisma;
  await db.user.create({ data: { id: "maya", name: "maya", email: "maya@example.test", staffRoleId: "r-staff", orgId: ORG } });
  await db.user.update({ where: { id: "ava" }, data: { managerId: "maya" } });
  mail.length = 0;
  assert.equal((await reminders.runReminders()).sent, 1);
  assert.deepEqual(mail.map((m) => m.email), ["maya@example.test"], "ava already had hers");
  assert.match(mail[0].line, /ava's Synthetic lifeguard expires/);
  assert.equal((await reminders.runReminders()).sent, 0);
});
