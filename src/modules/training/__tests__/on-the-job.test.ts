import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import {
  cleanObservation, hoursInWords, hoursProgress, observationPasses, observeSteps, pathProgress, practiseList, readClock, readObservationRecord, wallClockInstant, windowStart,
} from "../shared/on-the-job";

/** Skills on the job (docs/training.md, e-learning phase 5): practical
 *  checklists, learning paths, sessions with a register, and in-service
 *  hours. Pure rules first, then against a real in-memory Postgres. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let signOff: typeof import("../features/sign-off/server/actions");
let paths: typeof import("../features/paths/server/actions");
let sessions: typeof import("../features/sessions/server/actions");
let sessionData: typeof import("../features/sessions/server/data");
let hours: typeof import("../features/hours/server/actions");
let hoursData: typeof import("../features/hours/server/data");
let me: typeof import("../features/me/server/on-the-job");
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
const ALL = ["training.manage", "training.assign", "training.signoff", "training.records.read"];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const dublinDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(d);
let practical = "", reading = "", induction = "";

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.organisation.upsert({ where: { id: ORG }, create: { id: ORG, name: "LeisureWorld", slug: "leisureworld-test" }, update: {} });
  await db.club.create({ data: { id: "site-b", name: "Bishopstown", orgId: ORG } });
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["maya", "ava", "riley", "noah"]) {
    await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG, jobTitle: "", siteIds: [] } });
  }
  await db.qualificationType.create({ data: { id: "qt-life", orgId: ORG, name: "Synthetic pool lifeguard", validityMonths: 24 } });
  practical = (await db.trainingCourse.create({ data: { orgId: ORG, title: "Synthetic spinal rescue", requiresSignoff: true, grantsTypeId: "qt-life",
    observation: [{ id: "s1", text: "Checks the scene is safe", critical: true }, { id: "s2", text: "Calls for a second lifeguard", critical: false }] } })).id;
  reading = (await db.trainingCourse.create({ data: { orgId: ORG, title: "Synthetic pool rules" } })).id;
  induction = (await db.trainingCourse.create({ data: { orgId: ORG, title: "Synthetic induction" } })).id;
  const mods = doubles();
  signOff = serverModule("src/modules/training/features/sign-off/server/actions.ts", mods);
  paths = serverModule("src/modules/training/features/paths/server/actions.ts", mods);
  sessions = serverModule("src/modules/training/features/sessions/server/actions.ts", mods);
  sessionData = serverModule("src/modules/training/features/sessions/server/data.ts", mods);
  hours = serverModule("src/modules/training/features/hours/server/actions.ts", mods);
  hoursData = serverModule("src/modules/training/features/hours/server/data.ts", mods);
  me = serverModule("src/modules/training/features/me/server/on-the-job.ts", mods);
});
after(async () => { await fixture?.close(); });

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

test("a saved checklist is trimmed, de-duplicated and capped; empty means none", () => {
  let n = 0;
  const id = () => `new${++n}`;
  assert.equal(cleanObservation([{ text: "  " }], id), null);
  assert.equal(cleanObservation("nope", id), null);
  const steps = cleanObservation([{ id: "a", text: " Enters  the water ", critical: true }, { id: "a", text: "Second" }, { id: "bad id!", text: "Third", critical: "yes" }], id)!;
  assert.deepEqual(steps, [{ id: "a", text: "Enters the water", critical: true }, { id: "new1", text: "Second", critical: false }, { id: "new2", text: "Third", critical: false }]);
  assert.equal(cleanObservation(Array.from({ length: 60 }, (_, i) => ({ text: `Step ${i}` })), id)!.length, 40);
});

test("every step must be marked, a must-see step can't be skipped, and any 'not yet' blocks sign-off", () => {
  const steps = [{ id: "a", text: "Scene safe", critical: true }, { id: "b", text: "Second lifeguard", critical: false }];
  assert.match(observeSteps(steps, { a: { result: "met" } }).problem!, /Second lifeguard/);
  assert.match(observeSteps(steps, { a: { result: "na" }, b: { result: "met" } }).problem!, /must be seen/);
  const ok = observeSteps(steps, { a: { result: "met" }, b: { result: "na", note: "  alone on deck " }, z: { result: "met" } });
  assert.equal(ok.problem, null);
  assert.deepEqual(ok.steps.map((s) => [s.id, s.result, s.note]), [["a", "met", ""], ["b", "na", "alone on deck"]]);
  assert.ok(observationPasses(ok.steps));
  const notYet = observeSteps(steps, { a: { result: "not-yet", note: "too slow" }, b: { result: "met" } }).steps;
  assert.ok(!observationPasses(notYet));
  assert.equal(practiseList(notYet), "Scene safe (too slow)");
  assert.equal(readObservationRecord({ steps: [{ id: "a", text: "x", result: "bogus" }] })!.steps.length, 0, "stored records are not trusted");
});

test("hours count over a rolling window ending today", () => {
  const on = new Date("2026-10-15T00:00:00Z");
  assert.equal(iso(windowStart(on, 12)), "2025-10-15");
  assert.equal(iso(windowStart(new Date("2026-03-31T00:00:00Z"), 1)), "2026-02-28");
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

test("a path shows each course done, open, overdue or missing", () => {
  const on = new Date("2026-10-15T09:00:00Z");
  const steps = [{ courseId: "a", dueDays: 0 }, { courseId: "b", dueDays: 7 }, { courseId: "c", dueDays: 14 }, { courseId: "d", dueDays: 30 }];
  const p = pathProgress(steps, [
    { courseId: "a", status: "COMPLETED", dueOn: null, completedAt: new Date("2026-10-01") },
    { courseId: "b", status: "ASSIGNED", dueOn: new Date("2026-10-10T00:00:00Z"), completedAt: null },
    { courseId: "c", status: "SUBMITTED", dueOn: new Date("2026-10-10T00:00:00Z"), completedAt: null },
  ], on);
  assert.deepEqual(p.states.map((s) => s.state), ["done", "open", "open", "missing"]);
  assert.ok(p.states[1].state === "open" && p.states[1].overdue);
  assert.ok(p.states[2].state === "open" && !p.states[2].overdue && p.states[2].submitted, "handed in is not overdue");
  assert.equal(p.done, 1);
  assert.equal(p.finishedOn, null);
  assert.ok(p.overdue);
  const all = pathProgress([{ courseId: "a", dueDays: 0 }], [{ courseId: "a", status: "COMPLETED", dueOn: null, completedAt: new Date("2026-10-02") }], on);
  assert.equal(iso(all.finishedOn!), "2026-10-02");
});

test("session times are Irish wall-clock times, summer and winter", () => {
  assert.equal(readClock("18:30"), 1110);
  assert.equal(readClock("24:00"), null);
  assert.equal(wallClockInstant("2026-11-03", 1110)!.toISOString(), "2026-11-03T18:30:00.000Z");
  assert.equal(wallClockInstant("2026-07-03", 1110)!.toISOString(), "2026-07-03T17:30:00.000Z");
  assert.equal(wallClockInstant("2027-03-28", 60), null, "01:00 doesn't happen when the clocks go forward");
});

// ---------------------------------------------------------------------------
// Against the database
// ---------------------------------------------------------------------------

test("a practical with a checklist is signed off only when every step is marked and met", async () => {
  const db = fixture.prisma;
  const a = await db.trainingAssignment.create({ data: { orgId: ORG, courseId: practical, userId: "ava", assignedByName: "maya", status: "SUBMITTED", submittedAt: new Date() } });
  as("maya", ALL);
  const unmarked = await signOff.signOffTraining(a.id, "");
  assert.ok(!unmarked.ok && /Mark every step/.test(unmarked.error));
  const back = await signOff.returnForPractice(a.id, "", { s1: { result: "met" }, s2: { result: "not-yet", note: "shout louder" } });
  assert.ok(back.ok);
  let row = await db.trainingAssignment.findUniqueOrThrow({ where: { id: a.id } });
  assert.equal(row.status, "ASSIGNED");
  assert.equal(row.signoffNote, "Calls for a second lifeguard (shout louder)", "sent back with what to practise");
  assert.equal(readObservationRecord(row.observation)!.steps[1].result, "not-yet");

  await db.trainingAssignment.update({ where: { id: a.id }, data: { status: "SUBMITTED", submittedAt: new Date() } });
  const refused = await signOff.signOffTraining(a.id, "", { s1: { result: "met" }, s2: { result: "not-yet" } });
  assert.ok(!refused.ok);
  const done = await signOff.signOffTraining(a.id, "Poolside, deep end", { s1: { result: "met" }, s2: { result: "met" } });
  assert.ok(done.ok, done.ok ? "" : done.error);
  row = await db.trainingAssignment.findUniqueOrThrow({ where: { id: a.id } });
  assert.equal(row.status, "COMPLETED");
  const record = readObservationRecord(row.observation)!;
  assert.equal(record.observedByName, "maya");
  assert.deepEqual(record.steps.map((s) => s.result), ["met", "met"]);
  assert.ok(await db.qualification.findFirst({ where: { userId: "ava", typeId: "qt-life" } }), "the qualification is recorded");
  assert.ok(await db.auditLog.findFirst({ where: { entityId: a.id, summary: { contains: "2-step checklist" } } }));
});

test("a path assigns each course not already done, due from the start date, and taking someone off cancels the rest", async () => {
  const db = fixture.prisma;
  as("maya", ALL);
  const saved = await paths.savePath(null, { title: "Synthetic first month", summary: "", steps: [{ courseId: reading, dueDays: 0 }, { courseId: induction, dueDays: 14 }] });
  assert.ok(saved.ok);
  const pathId = saved.ok ? saved.id : "";
  await db.trainingAssignment.create({ data: { orgId: ORG, courseId: reading, userId: "riley", assignedByName: "maya", status: "COMPLETED", completedAt: new Date() } });
  const enrolled = await paths.enrolInPath(pathId, ["ava", "riley"], "2026-11-02");
  assert.deepEqual(enrolled, { ok: true, enrolled: 2, assigned: 3 }, "riley has done the reading already");
  const avaInduction = await db.trainingAssignment.findFirstOrThrow({ where: { userId: "ava", courseId: induction } });
  assert.equal(iso(avaInduction.dueOn!), "2026-11-16");
  const again = await paths.enrolInPath(pathId, ["ava"], "2026-11-02");
  assert.ok(!again.ok, "nobody is put on the same path twice");

  const enrolment = await db.trainingPathEnrolment.findFirstOrThrow({ where: { pathId, userId: "ava" } });
  assert.ok((await paths.leavePath(enrolment.id, "Moved to the gym")).ok);
  assert.equal((await db.trainingAssignment.findUniqueOrThrow({ where: { id: avaInduction.id } })).status, "CANCELLED");
  assert.ok((await paths.enrolInPath(pathId, ["ava"], "2026-12-01")).ok, "they can be put back on later");

  as("noah", ["training.records.read"]);
  assert.ok(!(await paths.savePath(null, { title: "Nope", summary: "", steps: [{ courseId: reading, dueDays: 0 }] })).ok, "building paths is the Author level");
});

test("a session's register gives hours to who came, completes its course and records the qualification", async () => {
  const db = fixture.prisma;
  as("maya", ALL);
  const yesterday = dublinDay(new Date(Date.now() - 86_400_000));
  await hours.saveHourTarget("qt-life", { hours: 20, windowMonths: 12 });
  const saved = await sessions.saveSession(null, { title: "Synthetic in-service", courseId: practical, siteId: "site-b", date: yesterday, start: "18:00", minutes: 90, capacity: 1, hoursTypeId: "qt-life" });
  assert.ok(saved.ok, saved.ok ? "" : saved.error);
  const id = saved.ok ? saved.id : "";
  assert.match((await sessions.addToSession(id, ["riley", "noah"]) as { error: string }).error, /Only 1 place/);
  assert.ok((await sessions.saveSession(id, { title: "Synthetic in-service", courseId: practical, siteId: "site-b", date: yesterday, start: "18:00", minutes: 90, capacity: 2, hoursTypeId: "qt-life" })).ok);
  assert.deepEqual(await sessions.addToSession(id, ["riley", "noah"]), { ok: true, added: 2 });
  assert.ok(!(await sessions.closeRegister(id)).ok, "everyone must be marked first");

  const places = await db.trainingSessionPlace.findMany({ where: { sessionId: id } });
  const riley = places.find((p) => p.userId === "riley")!, noah = places.find((p) => p.userId === "noah")!;
  assert.ok((await sessions.markPlace(riley.id, "ATTENDED")).ok);
  assert.ok((await sessions.markPlace(noah.id, "ABSENT")).ok);
  assert.ok(!(await sessions.removeFromSession(noah.id)).ok, "someone on the register isn't just taken off");

  assert.deepEqual(await sessions.closeRegister(id), { ok: true, attended: 1 });
  const credited = await db.trainingHours.findMany({ where: { sessionId: id } });
  assert.deepEqual(credited.map((h) => [h.userId, h.minutes, h.typeId]), [["riley", 90, "qt-life"]]);
  const done = await db.trainingAssignment.findFirstOrThrow({ where: { userId: "riley", courseId: practical } });
  assert.equal(done.status, "COMPLETED");
  assert.ok(await db.qualification.findFirst({ where: { userId: "riley", typeId: "qt-life" } }));
  assert.ok(!(await sessions.markPlace(riley.id, "ABSENT")).ok, "a closed register can't change");
  assert.ok(!(await sessions.closeRegister(id)).ok);

  const detail = await sessionData.sessionDetail(id);
  assert.equal(detail!.attended, 1);
  assert.equal(detail!.session.open, false);
});

test("hours are logged for others, never yourself, count against the target and can be taken off", async () => {
  const db = fixture.prisma;
  as("maya", ALL);
  assert.ok(!(await hours.logHours(["maya"], { on: dublinDay(new Date()), minutes: 60, topic: "Drill" })).ok);
  assert.ok(!(await hours.logHours(["riley"], { on: "2099-01-01", minutes: 60, topic: "Drill" })).ok, "not for a day to come");
  const logged = await hours.logHours(["riley"], { typeId: "qt-life", on: dublinDay(new Date()), minutes: 60, topic: "Synthetic deep-end drill" });
  assert.deepEqual(logged, { ok: true, logged: 1 });

  const overview = await hoursData.hoursOverview();
  const target = overview.summaries.find((s) => s.typeId === "qt-life")!;
  const rileyRow = target.rows.find((r) => r.userId === "riley")!;
  assert.equal(rileyRow.minutes, 150, "90 from the session and 60 logged");
  assert.ok(target.rows.some((r) => r.userId === "ava"), "ava holds it from her sign-off");

  const entry = await db.trainingHours.findFirstOrThrow({ where: { userId: "riley", sessionId: null } });
  assert.ok(!(await hours.removeHours(entry.id, "")).ok, "a reason is needed");
  assert.ok((await hours.removeHours(entry.id, "Logged twice")).ok);
  assert.ok((await db.trainingHours.findUniqueOrThrow({ where: { id: entry.id } })).removedAt);

  as("noah", ["training.records.read"]);
  assert.ok(!(await hours.saveHourTarget("qt-life", { hours: 5, windowMonths: 12 })).ok);
  assert.ok(!(await hours.logHours(["riley"], { on: dublinDay(new Date()), minutes: 60, topic: "Drill" })).ok);
});

test("Turnfin Me shows a person their own paths, sessions, hours and practical", async () => {
  const plan = await me.myPlan("riley", ORG);
  assert.equal(plan.paths.length, 1);
  assert.equal(plan.paths[0].done, 1);
  assert.equal(plan.sessions[0].status, "ATTENDED");
  assert.equal(plan.sessions[0].site, "Bishopstown");
  assert.equal(plan.hours.progress[0].minutes, 90);
  const ava = await fixture.prisma.trainingAssignment.findFirstOrThrow({ where: { userId: "ava", courseId: practical } });
  const mine = await me.myPractical("ava", ava.id);
  assert.equal(mine!.steps.length, 2);
  assert.equal(mine!.last!.steps[0].result, "met");
  assert.equal(await me.myPractical("riley", ava.id), null, "never someone else's");
});
