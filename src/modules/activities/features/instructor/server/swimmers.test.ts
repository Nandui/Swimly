import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Session } from "next-auth";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { parseDateOnly, today } from "@/lib/format";

/** Owner rule: an instructor can find any swimmer with a current place at the
 *  working site, but medical notes only for swimmers in a class they teach or
 *  cover today. Other sites, contacts and staff notes never appear. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let lookup: typeof import("@/modules/activities/features/instructor/server/swimmers");
let current: Session;
const deckSession = (id: string, permissions = ["attendance.mark"], screens = ["instructor"]) =>
  ({ user: { id, name: id, permissions, screens, isSuperadmin: false } }) as unknown as Session;

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  for (const id of ["teacher", "cover", "other"]) await db.user.create({ data: { id, name: id, email: `${id}@example.test`, passwordHash: "unused" } });
  const programme = await db.programme.create({ data: { clubId: "club_bishopstown", name: "Synthetic swimming" } });
  const level = await db.level.create({ data: { programmeId: programme.id, name: "Otters" } });
  const place = async (courseId: string, clubId: string, instructorId: string | null, firstName: string) => {
    await db.course.upsert({ where: { id: courseId }, update: {}, create: { id: courseId, clubId, levelId: level.id, dayOfWeek: "MONDAY", startMinutes: 900, durationMinutes: 30, instructorId } });
    const student = await db.student.create({ data: { clubId, firstName, lastName: "Example", medicalNotes: `Synthetic note for ${firstName}`, contactEmail: "family@example.test", notes: "staff note" } });
    await db.enrolment.create({ data: { studentId: student.id, courseId, levelId: level.id, programmeId: programme.id, startedOn: new Date("2026-01-01") } });
  };
  await place("taught", "club_bishopstown", "teacher", "Taught");
  await place("covered", "club_bishopstown", "other", "Covered");
  await place("elsewhere", "club_bishopstown", "other", "Stranger");
  await place("far", "club_churchfield", "teacher", "Farsite");
  await db.classCover.create({ data: { courseId: "covered", date: parseDateOnly(today()), coverById: "cover", coverByName: "cover", instructorId: "other", instructorName: "other" } });
  lookup = serverModule<typeof import("@/modules/activities/features/instructor/server/swimmers")>("src/modules/activities/features/instructor/server/swimmers.ts", {
    "@/lib/prisma": { prisma: db },
    "@/lib/clubs/current": { currentClubId: async () => "club_bishopstown" },
    "server-only": {},
    "@/lib/authz": { AuthorizationError: class extends Error {}, requireSession: async () => current, can: (s: Session, p: string) => s.user.permissions.includes(p) },
  });
});
after(async () => fixture?.close());

test("medical notes only for swimmers the instructor teaches; the rest are a flag; other sites are absent", async () => {
  current = deckSession("teacher");
  const rows = await lookup.findSiteSwimmers("example");
  assert.deepEqual(rows.map((r) => r.name).sort(), ["Covered Example", "Stranger Example", "Taught Example"]);
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
  assert.equal(byName["Taught Example"].medicalNotes, "Synthetic note for Taught");
  assert.equal(byName["Stranger Example"].medicalNotes, null);
  assert.equal(byName["Stranger Example"].hasMedicalNotes, true);
  const encoded = JSON.stringify(rows);
  for (const hidden of ["family@example.test", "staff note", "Farsite"]) assert.equal(encoded.includes(hidden), false);
});

test("covering a class today unlocks that class's notes only", async () => {
  current = deckSession("cover");
  const byName = Object.fromEntries((await lookup.findSiteSwimmers("example")).map((r) => [r.name, r]));
  assert.equal(byName["Covered Example"].medicalNotes, "Synthetic note for Covered");
  assert.equal(byName["Taught Example"].medicalNotes, null);
});

test("the lookup is for the deck, and short queries return nothing", async () => {
  current = deckSession("teacher", ["students.manage"], ["students"]);
  await assert.rejects(lookup.findSiteSwimmers("example"), /pool deck/);
  current = deckSession("teacher");
  assert.deepEqual(await lookup.findSiteSwimmers("e"), []);
});
