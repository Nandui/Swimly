import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { newCertificateCode, readCertificateCode } from "../shared/certificates";
import { addDays, addMonths, audienceInWords, cellInWords, csvRows, isCompliant, matrixCell, ruleCovers, ruleState, timingInWords, type RuleHistory } from "../shared/rules";

/** The compliance autopilot (e-learning phase 4): training
 *  rules, the daily run that assigns and renews, the matrix and certificates.
 *  Pure rules first, then against a real in-memory Postgres. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let rules: typeof import("../features/compliance/server/actions");
let engine: typeof import("../features/compliance/server/engine");
let data: typeof import("../features/compliance/server/data");
let check: typeof import("../features/compliance/server/certificate");
let mine: typeof import("../features/me/server/certificate");
const ORG = "org_leisureworld";
const state = { id: "maya", permissions: [] as string[] };

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions, screens: ["training"], primaryScreens: ["training"], grants: [], authMethod: "password", authAt: Date.now() } };
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
    "@/lib/clubs/current": { currentClubId: async () => "club_bishopstown", currentClubIdIfAny: async () => null },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
}
const as = (id: string, permissions: string[] = []) => Object.assign(state, { id, permissions });
const MANAGER = ["training.manage", "training.assign", "training.records.read"];

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.organisation.upsert({ where: { id: ORG }, create: { id: ORG, name: "LeisureWorld", slug: "leisureworld-test" }, update: {} });
  await db.club.create({ data: { id: "site-b", name: "Bishopstown", orgId: ORG } });
  await db.club.create({ data: { id: "site-c", name: "Churchfield", orgId: ORG } });
  await db.department.create({ data: { id: "dep-aq", orgId: ORG, name: "Aquatics" } });
  await db.department.create({ data: { id: "dep-gym", orgId: ORG, name: "Gym" } });
  await db.position.create({ data: { id: "pos-lg", orgId: ORG, name: "Lifeguard" } });
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  await db.staffRole.create({ data: { id: "r-sup", name: "Supervisor", permissions: [], screens: [] } });
  const people: { id: string; role?: string; sites?: string[]; position?: string; deps?: string[]; active?: boolean }[] = [
    { id: "maya", role: "r-sup" },
    { id: "ava", sites: ["site-b"], position: "pos-lg", deps: ["dep-aq"] },
    { id: "riley", sites: ["site-c"], position: "pos-lg", deps: ["dep-aq"] },
    { id: "noah", sites: ["site-b"], deps: ["dep-gym"] },
    { id: "zoe", sites: [], position: "pos-lg", deps: ["dep-aq"] },
    { id: "gone", sites: ["site-b"], position: "pos-lg", deps: ["dep-aq"], active: false },
  ];
  for (const p of people) {
    await db.user.create({ data: { id: p.id, name: p.id, email: `${p.id}@example.invalid`, staffRoleId: p.role ?? "r-staff", orgId: ORG, jobTitle: "", siteIds: p.sites ?? [], positionId: p.position ?? null, isActive: p.active ?? true } });
    for (const d of p.deps ?? []) await db.userDepartment.create({ data: { userId: p.id, departmentId: d } });
  }
  rules = serverModule("src/modules/training/features/compliance/server/actions.ts", doubles());
  engine = serverModule("src/modules/training/features/compliance/server/engine.ts", doubles());
  data = serverModule("src/modules/training/features/compliance/server/data.ts", doubles());
  check = serverModule("src/modules/training/features/compliance/server/certificate.ts", doubles());
  mine = serverModule("src/modules/training/features/me/server/certificate.ts", doubles());
});
after(async () => { await fixture?.close(); });

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

const person = (over: Partial<Parameters<typeof ruleCovers>[1]> = {}) => ({ id: "p", roleId: "r1", departmentIds: ["d1"], siteIds: ["s1"], positionId: "pos1", ...over });
const audience = (over: Partial<Parameters<typeof ruleCovers>[0]> = {}) => ({ roleIds: [], departmentIds: [], siteIds: [], positionIds: [], ...over });

test("a rule covers everyone unless it narrows by role, department, site or position", () => {
  assert.ok(ruleCovers(audience(), person()));
  assert.ok(ruleCovers(audience({ positionIds: ["pos1"], departmentIds: ["d1", "d2"] }), person()));
  assert.ok(!ruleCovers(audience({ positionIds: ["pos2"] }), person()));
  assert.ok(!ruleCovers(audience({ roleIds: ["r2"] }), person()));
  assert.ok(!ruleCovers(audience({ departmentIds: ["d2"] }), person()));
  assert.ok(!ruleCovers(audience({ siteIds: ["s2"] }), person()));
  assert.ok(ruleCovers(audience({ siteIds: ["s2"] }), person({ siteIds: [] })), "someone at every site is covered by a site rule");
  assert.ok(!ruleCovers(audience({ positionIds: ["pos1"] }), person({ positionId: null })));
});

test("months add to the same day, or the month's last day", () => {
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
  assert.equal(addMonths(day("2026-01-31"), 1).toISOString().slice(0, 10), "2026-02-28");
  assert.equal(addMonths(day("2028-01-31"), 1).toISOString().slice(0, 10), "2028-02-29");
  assert.equal(addMonths(day("2026-10-15"), 12).toISOString().slice(0, 10), "2027-10-15");
  assert.equal(addDays(new Date("2026-10-15T22:30:00Z"), 30).toISOString().slice(0, 10), "2026-11-14", "times of day are dropped");
});

const rule = { id: "rule1", dueDays: 30, renewMonths: 12, renewLeadDays: 30 };
const h = (over: Partial<RuleHistory>): RuleHistory => ({ status: "COMPLETED", assignedAt: new Date("2025-01-01"), completedAt: null, cancelledAt: null, ruleId: null, ...over });
const ON = new Date("2026-10-15T09:00:00Z");

test("the rule assigns the never-done, leaves open and finished training alone, and renews ahead of time", () => {
  assert.deepEqual(ruleState(rule, [], ON), { state: "assign", dueOn: new Date("2026-11-14T00:00:00Z"), renewal: false });
  assert.equal(ruleState(rule, [h({ status: "ASSIGNED" })], ON).state, "open");
  assert.equal(ruleState(rule, [h({ status: "SUBMITTED" })], ON).state, "open");
  assert.equal(ruleState(rule, [h({ completedAt: new Date("2026-03-01") })], ON).state, "done");
  // Done 1 Nov 2025: due again 1 Nov 2026, assigned from 2 Oct 2026, due on the renewal date.
  assert.deepEqual(ruleState(rule, [h({ completedAt: new Date("2025-11-01") })], ON), { state: "assign", dueOn: new Date("2026-11-01T00:00:00Z"), renewal: true });
  // Long out of date: the usual 30 days from today.
  assert.deepEqual(ruleState(rule, [h({ completedAt: new Date("2024-06-01") })], ON), { state: "assign", dueOn: new Date("2026-11-14T00:00:00Z"), renewal: true });
  assert.equal(ruleState({ ...rule, renewMonths: null }, [h({ completedAt: new Date("2020-01-01") })], ON).state, "done", "a one-off course is never due again");
});

test("cancelling the rule's own assignment excuses the person until it is next due", () => {
  const cancelled = h({ status: "CANCELLED", ruleId: "rule1", assignedAt: new Date("2026-09-01"), cancelledAt: new Date("2026-09-02") });
  assert.equal(ruleState(rule, [cancelled], ON).state, "excused");
  assert.equal(ruleState(rule, [{ ...cancelled, ruleId: null }], ON).state, "assign", "cancelling a hand-assigned one excuses nothing");
  assert.equal(ruleState(rule, [{ ...cancelled, ruleId: "other" }], ON).state, "assign");
  const doneAfter = h({ completedAt: new Date("2026-09-10") });
  assert.equal(ruleState(rule, [cancelled, doneAfter], ON).state, "done", "finishing it later replaces the excuse");
  // Excused from last year's renewal; this year's renewal comes round again.
  const lastYear = [h({ completedAt: new Date("2024-11-01") }), h({ status: "CANCELLED", ruleId: "rule1", assignedAt: new Date("2025-10-05"), cancelledAt: new Date("2025-10-06") })];
  assert.equal(ruleState(rule, lastYear, ON).state, "excused", "the excuse holds for the renewal it was cancelled for");
});

test("matrix cells say where someone stands, and what counts as in date", () => {
  const hd = (over: Partial<RuleHistory & { dueOn: Date | null }>) => ({ ...h(over), dueOn: over.dueOn ?? null });
  assert.deepEqual(matrixCell(rule, [], ON), { kind: "missing" });
  assert.deepEqual(matrixCell(rule, [hd({ status: "ASSIGNED", dueOn: new Date("2026-10-01") })], ON), { kind: "due", on: "2026-10-01", overdue: true, submitted: false });
  assert.deepEqual(matrixCell(rule, [hd({ completedAt: new Date("2026-03-01") })], ON), { kind: "done", on: "2026-03-01", dueAgain: "2027-03-01", soon: false });
  assert.equal((matrixCell(rule, [hd({ completedAt: new Date("2025-11-20") })], ON) as { soon: boolean }).soon, true, "due again within 60 days");
  assert.deepEqual(matrixCell(rule, [hd({ completedAt: new Date("2025-01-01") })], ON), { kind: "expired", on: "2026-01-01" });
  assert.ok(isCompliant({ kind: "excused" }) && !isCompliant({ kind: "expired", on: "2026-01-01" }));
  assert.equal(cellInWords(null), "Not needed");
  assert.equal(cellInWords({ kind: "expired", on: "2026-01-01" }), "Out of date since 2026-01-01");
});

test("rules read in plain words, and the download never runs a formula", () => {
  const names = { roles: new Map([["r1", "Supervisor"]]), departments: new Map([["d1", "Aquatics"]]), sites: new Map([["s1", "Bishopstown"]]), positions: new Map([["pos1", "Lifeguards"]]) };
  assert.equal(audienceInWords(audience(), names), "Everyone");
  assert.equal(audienceInWords(audience({ positionIds: ["pos1"], siteIds: ["s1"] }), names), "Lifeguards at Bishopstown");
  assert.equal(audienceInWords(audience({ departmentIds: ["d1"] }), names), "Everyone in Aquatics");
  assert.equal(timingInWords({ dueDays: 14, renewMonths: 12, renewLeadDays: 30 }), "14 days to finish, again every year");
  assert.equal(timingInWords({ dueDays: 1, renewMonths: null, renewLeadDays: 30 }), "1 day to finish, once");
  assert.equal(timingInWords({ dueDays: 30, renewMonths: 24, renewLeadDays: 30 }), "30 days to finish, again every 2 years");
  assert.equal(csvRows([["Name", "=HYPERLINK(\"x\")"], ["Ava \"A\"", "-1"]]), "\"Name\",\"'=HYPERLINK(\"\"x\"\")\"\r\n\"Ava \"\"A\"\"\",\"'-1\"");
});

test("certificate codes are easy to read aloud and forgiving to type", () => {
  const code = newCertificateCode();
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.ok(!/[01OIL]/.test(code), "no letters that look like numbers");
  assert.equal(readCertificateCode(` ${code.toLowerCase().replaceAll("-", " ")} `), code);
  assert.equal(readCertificateCode("nonsense"), null);
});

// ---------------------------------------------------------------------------
// Against the database
// ---------------------------------------------------------------------------

async function course(title: string) {
  return fixture.prisma.trainingCourse.create({ data: { orgId: ORG, title, content: "Read the pool safety operating procedure." } });
}
const assignmentsOf = (courseId: string) => fixture.prisma.trainingAssignment.findMany({ where: { courseId }, orderBy: { userId: "asc" } });

test("only someone who manages training everywhere can add a rule", async () => {
  const c = await course("Rule rights");
  as("riley", ["training.records.read"]);
  assert.equal((await rules.saveTrainingRule(c.id, { dueDays: 30, renewMonths: null })).ok, false);
  as("maya", MANAGER);
  assert.match(JSON.stringify(await rules.saveTrainingRule(c.id, { dueDays: 0, renewMonths: null })), /at least a day/);
  assert.match(JSON.stringify(await rules.saveTrainingRule(c.id, { positionIds: ["pos-gone"], dueDays: 30, renewMonths: null })), /removed/);
  assert.equal(await fixture.prisma.trainingRule.count({ where: { courseId: c.id } }), 0);
});

test("saving a rule assigns it to everyone it covers, once, with an audit row each", async () => {
  as("maya", MANAGER);
  const c = await course("Pool safety");
  const saved = await rules.saveTrainingRule(c.id, { positionIds: ["pos-lg"], siteIds: ["site-b"], dueDays: 14, renewMonths: 12 });
  assert.deepEqual(saved, { ok: true, assigned: 2 });
  const rows = await assignmentsOf(c.id);
  assert.deepEqual(rows.map((r) => r.userId), ["ava", "zoe"], "Riley works elsewhere, Noah isn't a lifeguard, and leavers are skipped");
  assert.ok(rows.every((r) => r.ruleId && r.assignedById === null && r.assignedByName === engine.AUTOPILOT_NAME && r.dueOn));
  assert.equal(await fixture.prisma.auditLog.count({ where: { entity: "TrainingAssignment", entityId: { in: rows.map((r) => r.id) }, action: "assign" } }), 2);
  assert.equal(await fixture.prisma.auditLog.count({ where: { entity: "TrainingRule", action: "create" } }) >= 1, true);

  const again = await engine.applyTrainingRules({ orgId: ORG });
  assert.equal(again.assigned, 0, "running again assigns nobody twice");
  assert.equal((await assignmentsOf(c.id)).length, 2);

  // Widening the rule picks up Riley.
  assert.deepEqual(await rules.saveTrainingRule(c.id, { positionIds: ["pos-lg"], dueDays: 14, renewMonths: 12 }), { ok: true, assigned: 1 });
  assert.ok(await fixture.prisma.auditLog.findFirst({ where: { entity: "TrainingRule", action: "update" } }));
});

test("a paused rule assigns nobody new; restarting catches up", async () => {
  as("maya", MANAGER);
  const c = await course("Gym induction");
  const ruleRow = await fixture.prisma.trainingRule.create({ data: { orgId: ORG, courseId: c.id, departmentIds: ["dep-gym"], createdByName: "maya", pausedAt: new Date() } });
  assert.equal((await engine.applyTrainingRules({ orgId: ORG, ruleId: ruleRow.id })).rules, 0);
  assert.equal((await assignmentsOf(c.id)).length, 0);
  assert.deepEqual(await rules.setTrainingRulePaused(ruleRow.id, false), { ok: true, assigned: 1 });
  assert.deepEqual((await assignmentsOf(c.id)).map((r) => r.userId), ["noah"]);
});

test("renewals come round, cancelled ones excuse, and the matrix shows it all", async () => {
  as("maya", MANAGER);
  const c = await course("Safeguarding");
  const ruleRow = await fixture.prisma.trainingRule.create({ data: { orgId: ORG, courseId: c.id, departmentIds: ["dep-aq"], dueDays: 30, renewMonths: 12, renewLeadDays: 30, createdByName: "maya" } });
  const now = new Date("2026-10-15T09:00:00Z");
  // Ava did it 11 months and three weeks ago (due again soon); Zoe did it two years ago; Riley never.
  await fixture.prisma.trainingAssignment.create({ data: { orgId: ORG, courseId: c.id, userId: "ava", status: "COMPLETED", completedAt: new Date("2025-10-25"), assignedByName: "maya" } });
  await fixture.prisma.trainingAssignment.create({ data: { orgId: ORG, courseId: c.id, userId: "zoe", status: "COMPLETED", completedAt: new Date("2024-10-01"), assignedByName: "maya" } });
  const run = await engine.applyTrainingRules({ orgId: ORG, ruleId: ruleRow.id, now });
  assert.deepEqual(run, { rules: 1, assigned: 3, renewals: 2 });
  const open = (await assignmentsOf(c.id)).filter((r) => r.status === "ASSIGNED");
  assert.deepEqual(open.map((r) => [r.userId, r.dueOn?.toISOString().slice(0, 10)]), [["ava", "2026-10-25"], ["riley", "2026-11-14"], ["zoe", "2026-11-14"]]);

  // Cancelling Riley's excuses Riley: the next run leaves them alone.
  const riley = open.find((r) => r.userId === "riley")!;
  await fixture.prisma.trainingAssignment.update({ where: { id: riley.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  assert.equal((await engine.applyTrainingRules({ orgId: ORG, ruleId: ruleRow.id, now })).assigned, 0);

  const matrix = await data.trainingMatrix({ course: c.id });
  assert.deepEqual(matrix.columns.map((col) => col.title), ["Safeguarding"]);
  const byName = new Map(matrix.rows.map((r) => [r.name, r.cells[0]?.kind]));
  assert.deepEqual(Object.fromEntries(byName), { ava: "due", riley: "excused", zoe: "due" });
  assert.deepEqual(matrix.summary, { needed: 3, compliant: 1, percent: 33 });

  const filtered = await data.trainingMatrix({ course: c.id, site: "site-c" });
  assert.deepEqual(filtered.rows.map((r) => r.name).sort(), ["riley", "zoe"], "a site filter keeps people who work everywhere");

  const listed = await data.trainingRules();
  const mineRule = listed.rules.find((r) => r.courseId === c.id)!;
  assert.equal(mineRule.audience, "Everyone in Aquatics");
  assert.equal(mineRule.covered, 3);
  assert.ok(listed.canManage);
  as("riley", ["training.records.read"]);
  assert.equal((await data.trainingRules()).canManage, false);
});

test("removing a rule keeps what it assigned and is audited", async () => {
  as("maya", MANAGER);
  const c = await course("Manual handling");
  await rules.saveTrainingRule(c.id, { departmentIds: ["dep-gym"], dueDays: 30, renewMonths: null });
  const ruleRow = await fixture.prisma.trainingRule.findUniqueOrThrow({ where: { courseId: c.id } });
  assert.equal((await rules.removeTrainingRule(ruleRow.id)).ok, true);
  assert.equal(await fixture.prisma.trainingRule.count({ where: { courseId: c.id } }), 0);
  assert.equal((await assignmentsOf(c.id)).length, 1);
  assert.ok(await fixture.prisma.auditLog.findFirst({ where: { entity: "TrainingRule", entityId: ruleRow.id, action: "delete" } }));
});

test("a finished course gets one lasting certificate code that a trainer can check", async () => {
  const c = await course("First aid refresher");
  const done = await fixture.prisma.trainingAssignment.create({ data: { orgId: ORG, courseId: c.id, userId: "ava", status: "COMPLETED", completedAt: new Date("2026-10-01"), assignedByName: "maya", signedOffByName: "maya" } });
  const open = await fixture.prisma.trainingAssignment.create({ data: { orgId: ORG, courseId: c.id, userId: "noah", assignedByName: "maya" } });
  assert.equal(await mine.myCertificate({ id: "noah", name: "noah" }, open.id), null, "nothing until it is finished");
  assert.equal(await mine.myCertificate({ id: "riley", name: "riley" }, done.id), null, "never someone else's");
  const first = await mine.myCertificate({ id: "ava", name: "ava" }, done.id);
  assert.match(first!.code!, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal((await mine.myCertificate({ id: "ava", name: "ava" }, done.id))!.code, first!.code, "the code never changes");

  as("riley", ["training.records.read"]);
  const found = await check.checkCertificate(first!.code!.toLowerCase().replaceAll("-", ""));
  assert.ok(found.found && found.course === "First aid refresher" && found.name === "ava" && found.standing);
  assert.equal((await check.checkCertificate("AAAA-BBBB-CCCC")).found, false);
  assert.equal((await check.checkCertificate("not a code")).found, false);
});
