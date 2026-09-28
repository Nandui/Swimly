import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "../test/pglite-prisma";
import { activeStaffHolding, isActiveStaff, isArchivedSite, liveSiteIds, liveSites, withSiteStatus, withSites, withStaff } from "./directory";

let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.club.create({ data: { id: "club_closed", name: "Closed site", sortOrder: 9, archivedAt: new Date("2026-01-01") } });
  const teacher = await db.staffRole.create({ data: { id: "role-teacher", name: "Example teacher", permissions: ["attendance.mark"], screens: ["instructor"] } });
  const desk = await db.staffRole.create({ data: { id: "role-desk", name: "Example desk", permissions: ["students.manage"], screens: ["students"] } });
  await db.user.createMany({ data: [
    { id: "teacher", name: "Taylor Example", email: "teacher@example.test", passwordHash: "unused", staffRoleId: teacher.id },
    { id: "former", name: "Former Example", email: "former@example.test", passwordHash: "unused", staffRoleId: teacher.id, isActive: false },
    { id: "desk", name: "Drew Example", email: "desk@example.test", passwordHash: "unused", staffRoleId: desk.id },
  ] });
});
after(async () => fixture?.close());

test("sites and people are added by id, with safe fallbacks for missing records", async () => {
  const db = fixture.prisma;
  const rows = [{ id: "a", clubId: "club_bishopstown", instructorId: "teacher" }, { id: "b", clubId: "club_gone", instructorId: null }];
  const withRefs = await withStaff(await withSites(rows, "clubId", "club", db), "instructorId", "instructor", db);
  assert.deepEqual(withRefs[0].club, { id: "club_bishopstown", name: "LeisureWorld Bishopstown" });
  assert.deepEqual(withRefs[0].instructor, { id: "teacher", name: "Taylor Example" });
  assert.deepEqual(withRefs[1].club, { id: "club_gone", name: "Removed site" });
  assert.equal(withRefs[1].instructor, null);
  const [closed] = await withSiteStatus([{ clubId: "club_closed" }], "clubId", "club", db);
  assert.ok(closed.club.archivedAt instanceof Date);
});

test("live sites exclude archived ones, in display order", async () => {
  const db = fixture.prisma;
  assert.deepEqual((await liveSites(db)).map((site) => site.id), ["club_bishopstown", "club_churchfield"]);
  assert.deepEqual((await liveSiteIds(db)).sort(), ["club_bishopstown", "club_churchfield"]);
  assert.equal(await isArchivedSite("club_closed", db), true);
  assert.equal(await isArchivedSite("club_bishopstown", db), false);
  assert.equal(await isArchivedSite("club_missing", db), true);
});

test("staff checks follow the account and its permissions, never a role name", async () => {
  const db = fixture.prisma;
  assert.equal(await isActiveStaff("teacher", db), true);
  assert.equal(await isActiveStaff("former", db), false);
  assert.deepEqual(await activeStaffHolding(["attendance.mark", "attendance.markAny"], db), [{ id: "teacher", name: "Taylor Example" }]);
});
