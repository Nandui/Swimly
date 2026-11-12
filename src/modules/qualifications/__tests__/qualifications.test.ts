import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { addDaysIso, parseDateOnly, today } from "@/lib/format";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { accessByReach, cleanLevels } from "@/lib/staff/levels";
import { hoursInWords, hoursProgress, windowStart } from "../shared/hours";

/** Qualifications (D26) against a real in-memory Postgres: what is expiring for the people a
 *  keeper covers, with Training faked behind the renewals plug; in-service hours logged for others
 *  and never yourself; a person's own hours for Turnfin Me and HR's export. Invented people. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let expiring: typeof import("../features/expiring/server/data");
let renew: typeof import("../features/expiring/server/actions");
let hours: typeof import("../features/hours/server/actions");
let hoursData: typeof import("../features/hours/server/data");
let mine: typeof import("../features/me/server/records");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; scopeKind: string; scopeId: string };
const state = { id: "maya", permissions: [] as string[], grants: [] as GrantRow[] };
const KEEPER: GrantRow = { roleName: "Qualifications lead", permissions: ["qualifications.manage"], scopeKind: "site", scopeId: "club_churchfield" };
/** Training, faked behind the renewals plug: what it was asked, and whether it is switched off. */
const training = { off: false, assigned: [] as { courseId: string; userIds: string[]; dueOn: string }[] };

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions, screens: [], primaryScreens: [], grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
function doubles() {
  return {
    "@/lib/prisma": { prisma: fixture.prisma },
    "@/lib/authz": {
      AuthorizationError: class extends Error {},
      requireSession: async () => session(),
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: () => true,
    },
    "@/lib/clubs/current": { currentClubId: async () => "club_churchfield", currentClubIdIfAny: async () => null },
    "@/modules/contributions": {
      qualificationRenewals: async () => (training.off ? null : {
        app: "training",
        find: async () => (row: { userId: string; typeId: string }) =>
          row.typeId === "qt-life" ? { courseId: "course-life", title: "Synthetic lifeguard renewal", assigned: row.userId === "ava", canAssign: true } : null,
        assign: async (courseId: string, userId: string, dueOn: string) => {
          training.assigned.push({ courseId, userIds: [userId], dueOn });
          return { ok: true };
        },
      }),
    },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
}
const as = (id: string, permissions: string[] = [], grants: GrantRow[] = []) => Object.assign(state, { id, permissions, grants });

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const [id, site] of [["maya", null], ["liam", "club_churchfield"], ["ava", "club_churchfield"], ["riley", "club_churchfield"], ["noah", "club_bishopstown"]] as const) {
    await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG, jobTitle: "", primaryClubId: site, siteIds: site ? [site] : [] } });
  }
  await db.qualificationType.create({ data: { id: "qt-life", orgId: ORG, name: "Synthetic pool lifeguard", validityMonths: 24 } });
  await db.qualificationType.create({ data: { id: "qt-aid", orgId: ORG, name: "Synthetic first aid", validityMonths: 36 } });
  const soon = parseDateOnly(addDaysIso(today(), 10));
  for (const [userId, typeId] of [["riley", "qt-life"], ["ava", "qt-life"], ["noah", "qt-life"], ["riley", "qt-aid"]] as const) {
    await db.qualification.create({ data: { orgId: ORG, userId, typeId, issuedOn: new Date("2024-01-01"), expiresOn: soon } });
  }
  const mods = doubles();
  expiring = serverModule("src/modules/qualifications/features/expiring/server/data.ts", mods);
  renew = serverModule("src/modules/qualifications/features/expiring/server/actions.ts", mods);
  hours = serverModule("src/modules/qualifications/features/hours/server/actions.ts", mods);
  hoursData = serverModule("src/modules/qualifications/features/hours/server/data.ts", mods);
  mine = serverModule("src/modules/qualifications/features/me/server/records.ts", mods);
});
after(async () => { await fixture?.close(); });

test("Training's Manage counts as Keep, so whoever checked certificates before D26 still does", () => {
  const before = cleanLevels({ training: "manage" });
  assert.equal(before.levels.qualifications, "keep");
  assert.ok(accessByReach(before).sites.includes("qualifications.manage"));
  assert.ok(!accessByReach(cleanLevels({ training: "author" })).sites.includes("qualifications.manage"), "Author never kept qualifications");
});

test("the expiring list covers only the keeper's people, each with the course that renews it", async () => {
  as("liam", [], [KEEPER]);
  const { rows } = await expiring.expiringQualifications();
  assert.deepEqual(rows.map((r) => [r.userId, r.qualification]).sort(), [["ava", "Synthetic pool lifeguard"], ["riley", "Synthetic first aid"], ["riley", "Synthetic pool lifeguard"]], "noah works at another site; liam's own are his to see but he holds none");
  const life = rows.find((r) => r.userId === "riley" && r.qualification === "Synthetic pool lifeguard")!;
  assert.equal(life.renewal?.courseId, "course-life");
  assert.equal(rows.find((r) => r.qualification === "Synthetic first aid")!.renewal, null, "no course gives first aid");
  assert.equal(rows.find((r) => r.userId === "ava")!.renewal?.assigned, true);
  assert.equal(await expiring.expiringCount(), 3);
});

test("assigning the course asks Training, due the day the qualification expires", async () => {
  as("liam", [], [KEEPER]);
  const expires = addDaysIso(today(), 10);
  assert.ok((await renew.assignRenewal("course-life", "riley", expires)).ok);
  assert.ok((await renew.assignRenewal("course-life", "riley", "2020-01-01")).ok);
  assert.deepEqual(training.assigned, [
    { courseId: "course-life", userIds: ["riley"], dueOn: expires },
    { courseId: "course-life", userIds: ["riley"], dueOn: "" },
  ], "an expired one gets no due date");
  training.off = true;
  assert.ok((await expiring.expiringQualifications()).rows.every((r) => r.renewal === null), "with Training off, no row offers a course");
  assert.equal((await renew.assignRenewal("course-life", "riley", expires)).ok, false);
  training.off = false;
  as("noah");
  await assert.rejects(renew.assignRenewal("course-life", "riley", expires), "someone who keeps no qualifications can't ask");
});

test("hours count over a rolling window ending today", () => {
  const on = new Date("2026-10-15T00:00:00Z");
  assert.equal(windowStart(on, 12).toISOString().slice(0, 10), "2025-10-15");
  assert.equal(windowStart(new Date("2026-03-31T00:00:00Z"), 1).toISOString().slice(0, 10), "2026-02-28");
  const entries = [
    { on: new Date("2025-10-14T00:00:00Z"), minutes: 600 }, // a day too old
    { on: new Date("2025-10-15T00:00:00Z"), minutes: 60 },
    { on: new Date("2026-10-15T00:00:00Z"), minutes: 90 },
    { on: new Date("2026-10-16T00:00:00Z"), minutes: 600 }, // not yet
  ];
  const p = hoursProgress(entries, { hours: 20, windowMonths: 12 }, on);
  assert.deepEqual({ minutes: p.minutes, needed: p.needed, met: p.met, percent: p.percent }, { minutes: 150, needed: 1200, met: false, percent: 12 });
  assert.ok(hoursProgress([{ on, minutes: 1200 }], { hours: 20, windowMonths: 12 }, on).met);
  assert.equal(hoursInWords(90), "1 h 30 min");
  assert.equal(hoursInWords(45), "45 min");
  assert.equal(hoursInWords(1200), "20 h");
});

test("hours are logged for others, never yourself, count against the target and can be taken off", async () => {
  const db = fixture.prisma;
  as("liam", [], [KEEPER]);
  assert.ok((await hours.saveHourTarget("qt-life", { hours: 20, windowMonths: 12 })).ok);
  const on = today();
  assert.ok(!(await hours.logHours(["liam"], { on, minutes: 60, topic: "Drill" })).ok, "not your own");
  assert.ok(!(await hours.logHours(["noah"], { on, minutes: 60, topic: "Drill" })).ok, "noah is at another site");
  assert.ok(!(await hours.logHours(["riley"], { on: "2099-01-01", minutes: 60, topic: "Drill" })).ok, "not for a day to come");
  assert.deepEqual(await hours.logHours(["riley", "ava"], { typeId: "qt-life", on, minutes: 90, topic: "Synthetic deep-end drill" }), { ok: true, logged: 2 });

  const overview = await hoursData.hoursOverview();
  const target = overview.summaries.find((s) => s.typeId === "qt-life")!;
  assert.deepEqual(target.rows.map((r) => [r.userId, r.minutes]).sort(), [["ava", 90], ["riley", 90]]);
  assert.ok(overview.loggable.every((p) => p.id !== "liam" && p.id !== "noah"));

  const entry = await db.trainingHours.findFirstOrThrow({ where: { userId: "ava" } });
  assert.ok(!(await hours.removeHours(entry.id, "")).ok, "a reason is needed");
  assert.ok((await hours.removeHours(entry.id, "Logged twice")).ok);
  assert.ok((await db.trainingHours.findUniqueOrThrow({ where: { id: entry.id } })).removedAt);
  assert.equal(await db.auditLog.count({ where: { entity: "TrainingHours" } }), 3);

  as("noah");
  await assert.rejects(hours.logHours(["riley"], { on, minutes: 60, topic: "Drill" }), "someone who keeps no qualifications can't log hours");
});

test("Turnfin Me and HR's export see only the person's own hours", async () => {
  const riley = await mine.myHours("riley", ORG);
  assert.deepEqual(riley.progress.map((p) => [p.typeName, p.minutes]), [["Synthetic pool lifeguard", 90]]);
  assert.equal(riley.log.length, 1);
  assert.equal((await mine.myHours("noah", ORG)).log.length, 0);
  const ava = await mine.hoursRecords("ava");
  assert.equal(ava.length, 1);
  assert.ok(ava[0].removedAt, "removed hours stay on the record");
});
