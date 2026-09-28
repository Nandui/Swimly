import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions } from "./permissions";
import { sessionUserFor, type Account } from "./session-user";

/** The role converter against a real (in-memory) database: a dry run writes
 *  nothing, nobody loses access, and a role that gains waits for review. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let convert: typeof import("./convert-roles");
/** The roles the migrations ship (Admin, Instructor, Viewer), as they were. */
const before_: Record<string, { id: string; permissions: string[] }> = {};

before(async () => {
  fixture = await isolatedPrisma();
  for (const role of await fixture.prisma.staffRole.findMany()) before_[role.name] = { id: role.id, permissions: role.permissions };
  convert = serverModule("src/lib/staff/convert-roles.ts", {
    "@/lib/prisma": { prisma: fixture.prisma },
    "@/lib/clubs/current": { currentClubIdIfAny: async () => null },
    "server-only": {},
  });
});
after(async () => fixture?.close());

const levelsOf = async (name: string) => (await fixture.prisma.staffRole.findUniqueOrThrow({ where: { name } })).levels;

test("a dry run reports every role and writes nothing", async () => {
  const report = await convert.convertRolesToLevels(fixture.prisma, { confirm: false, allowGains: false });
  assert.deepEqual(report.map((r) => r.name).sort(), ["Admin", "Instructor", "Viewer"]);
  assert.ok(report.every((r) => r.losses.length === 0), "nobody loses access");
  assert.equal(await levelsOf("Admin"), null);
  assert.equal(await fixture.prisma.auditLog.count({ where: { action: "convert-to-levels" } }), 0);
});

test("confirming converts roles that change nothing; roles that would gain wait", async () => {
  const report = await convert.convertRolesToLevels(fixture.prisma, { confirm: true, allowGains: false });
  assert.ok(report.find((r) => r.name === "Admin")!.converted);
  assert.deepEqual(await levelsOf("Admin"), { admin: "manage" });
  for (const r of report) assert.equal(r.converted, r.gains.length === 0, `${r.name} converts only when it gains nothing`);
  // The shipped Instructor also edits swimmers and enrolments, which is the
  // desk's work: as Desk plus Pool deck it would gain parent access, so it waits.
  const instructor = report.find((r) => r.name === "Instructor")!;
  assert.match(instructor.levels, /Swim school: Desk/);
  assert.ok(instructor.gains.includes("parents.manage"));
  assert.equal(await levelsOf("Instructor"), null);
  const audit = await fixture.prisma.auditLog.findMany({ where: { action: "convert-to-levels" } });
  assert.equal(audit.length, report.filter((r) => r.converted).length);
});

test("a converted administrator signs in with exactly the access they had", async () => {
  const role = await fixture.prisma.staffRole.findUniqueOrThrow({ where: { name: "Admin" } });
  const account: Account = {
    id: "alex", name: "Alex", email: "alex@example.invalid", isActive: true, orgId: null, isSuperadmin: false, siteIds: [],
    staffRole: { id: role.id, name: role.name, permissions: role.permissions, levels: role.levels, extras: role.extras },
  };
  const user = sessionUserFor(account, null)!;
  assert.deepEqual([...expandPermissions(user.permissions)].sort(), [...expandPermissions(before_.Admin.permissions)].sort());
});

test("after review, --allow-gains converts the rest, and a second run finds nothing", async () => {
  const report = await convert.convertRolesToLevels(fixture.prisma, { confirm: true, allowGains: true });
  assert.ok(report.every((r) => r.converted));
  assert.deepEqual(await levelsOf("Viewer"), { "swim-school": "desk" });
  assert.deepEqual(await levelsOf("Instructor"), { "swim-school": "desk", "pool-deck": "teach" });
  assert.deepEqual(await convert.convertRolesToLevels(fixture.prisma, { confirm: true, allowGains: true }), []);
});
