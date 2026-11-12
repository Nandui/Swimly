import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { addDaysIso, today } from "@/lib/format";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { addMonthsIso } from "../shared/rules";

/** Risk assessments end to end on an isolated database, with invented people, sites' areas and
 *  hazards: drafts at your own sites only, once per form; hazards whose numbers are never reused;
 *  sign-off by the owner and, on top, by someone else; a change clearing the sign-off; reviews and
 *  review requests; archiving; the lists, Home items, the hazard register and the request an
 *  incident raises; and an audit row with every change. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let assessments: typeof import("../features/assessments/server/actions");
let lists: typeof import("../features/assessments/server/data");
let people: typeof import("../features/assessments/server/people");
let hazards: typeof import("../features/hazards/server/actions");
let highRisk: typeof import("../features/hazards/server/data");
let register: typeof import("../features/hazards/server/register");
let reviews: typeof import("../features/reviews/server/actions");
let due: typeof import("../features/reviews/server/data");
let home: typeof import("../features/reviews/server/home");
let incident: typeof import("../features/reviews/server/from-incident");
let load: typeof import("../shared/load");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "orla", permissions: [] as string[], grants: [] as GrantRow[] };
let bishopstown = "", churchfield = "";

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: ["risk-assessments"], primaryScreens: ["risk-assessments"], grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
const as = (id: string, grants: GrantRow[]) => Object.assign(state, { id, permissions: [], grants });
const at = (siteId: string, ...permissions: string[]): GrantRow => ({ roleName: "Site", permissions, screens: ["risk-assessments"], scopeKind: "site", scopeId: siteId });
const uuid = () => crypto.randomUUID();
const row = (id: string) => fixture.prisma.riskAssessment.findUniqueOrThrow({ where: { id } });
const version = async (id: string) => (await row(id)).version;
const events = async (id: string) => (await fixture.prisma.riskEvent.findMany({ where: { assessmentId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })).map((e) => e.action);

const writer = () => as("orla", [at(bishopstown, "risk.write")]);
const reader = () => as("sam", [at(bishopstown, "risk.read")]);
const manager = () => as("mia", [at(bishopstown, "risk.manage")]);
const executive = () => as("ed", [at(bishopstown, "risk.read", "risk.signoff")]);

const draft = (siteId: string, extra: Record<string, unknown> = {}) => ({
  id: uuid(), operationId: uuid(), siteId, subjectType: "area" as const, subject: "Main pool", scope: "Public swimming and lessons", departmentId: "", ownerId: "orla",
  assessorName: "", assessedOn: addDaysIso(today(), -10), reviewMonths: 12, targetScore: 8, ...extra,
});
const hazard = (extra: Record<string, unknown> = {}) => ({
  hazard: "Wet floor at the pool edge", riskFactor: "Water carried out of the pool", personsAtRisk: ["Customers" as const, "Children" as const], consequence: "A fall on tiles",
  inherentLikelihood: 4, inherentSeverity: 3, controls: "Non-slip tiles; no-running signs", likelihood: 2, severity: 3, furtherAction: "", category: "physical" as const, ...extra,
});
async function add(id: string, extra: Record<string, unknown> = {}) {
  const hazardId = uuid();
  const result = await hazards.addHazard({ assessmentId: id, operationId: uuid(), version: await version(id), hazardId, ...hazard(extra) });
  assert.deepEqual(result, { ok: true, id });
  return hazardId;
}
const move = async (id: string, m: Parameters<typeof assessments.moveAssessment>[0]["move"], note = "") => assessments.moveAssessment({ id, operationId: uuid(), version: await version(id), move: m, note });

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const clubs = await db.club.findMany({ where: { orgId: ORG }, orderBy: { name: "asc" } });
  bishopstown = clubs.find((c) => c.name.includes("Bishopstown"))!.id;
  churchfield = clubs.find((c) => c.name.includes("Churchfield"))!.id;
  for (const siteId of [bishopstown, churchfield]) {
    await db.siteArea.create({ data: { orgId: ORG, siteId, name: "Main pool" } });
    await db.siteArea.create({ data: { orgId: ORG, siteId, name: "Gym" } });
  }
  await db.position.create({ data: { orgId: ORG, name: "Lifeguard" } });
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  await db.staffRole.create({ data: { id: "r-writer", name: "Writer", permissions: ["risk.write", "risk.read"], screens: [] } });
  for (const [id, role] of [["orla", "r-writer"], ["wes", "r-writer"], ["sam", "r-staff"], ["mia", "r-staff"], ["ed", "r-staff"]] as const) {
    await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: role, orgId: ORG } });
  }
  const d = {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": {
      AuthorizationError: class AuthorizationError extends Error {},
      requireSession: async () => session(),
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: () => true,
    },
    "@/lib/clubs/current": { currentClubId: async () => bishopstown, currentClubIdIfAny: async () => bishopstown },
    "next/cache": { revalidatePath() {} },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  const at = (file: string) => `src/modules/risk/${file}`;
  assessments = serverModule(at("features/assessments/server/actions.ts"), d);
  lists = serverModule(at("features/assessments/server/data.ts"), d);
  people = serverModule(at("features/assessments/server/people.ts"), d);
  hazards = serverModule(at("features/hazards/server/actions.ts"), d);
  highRisk = serverModule(at("features/hazards/server/data.ts"), d);
  register = serverModule(at("features/hazards/server/register.ts"), d);
  reviews = serverModule(at("features/reviews/server/actions.ts"), d);
  due = serverModule(at("features/reviews/server/data.ts"), d);
  home = serverModule(at("features/reviews/server/home.ts"), d);
  incident = serverModule(at("features/reviews/server/from-incident.ts"), d);
  load = serverModule(at("shared/load.ts"), d);
});
after(async () => { await fixture?.close(); });

let pool = "", lifeguard = "";

test("writers start a draft at their own sites only, and sending the same form twice saves once", async () => {
  writer();
  const input = draft(bishopstown);
  assert.deepEqual(await assessments.createAssessment(input), { ok: true, id: input.id });
  assert.deepEqual(await assessments.createAssessment(input), { ok: true, id: input.id }, "a second press");
  assert.equal(await fixture.prisma.riskAssessment.count(), 1);
  const saved = await row(input.id);
  assert.match(saved.reference, /^RA-[A-Z0-9]+-0001$/);
  assert.equal(saved.status, "draft");
  assert.equal(saved.orgId, ORG);
  assert.equal(saved.ownerName, "orla");
  assert.equal(saved.nextReviewOn, addMonthsIso(input.assessedOn, 12));
  pool = input.id;
  const audit = await fixture.prisma.auditLog.findMany({ where: { entity: "RiskAssessment" } });
  assert.equal(audit.length, 1);
  assert.equal(audit[0].module, "Risk assessments");
  assert.equal(audit[0].clubId, bishopstown);

  assert.equal((await assessments.createAssessment(draft(churchfield))).ok, false, "a site the role does not cover");
  assert.equal((await assessments.createAssessment(draft(bishopstown, { subject: "Car park" }))).ok, false, "an area not on the site's list");
  assert.equal((await assessments.createAssessment(draft(bishopstown, { subject: "Gym", assessedOn: addDaysIso(today(), 1) }))).ok, false, "a day in the future");
  assert.equal((await assessments.createAssessment(draft(bishopstown, { subject: "Gym", ownerId: "sam" }))).ok, false, "an owner whose role does not write");
  const again = await assessments.createAssessment(draft(bishopstown, { subject: "main pool" }));
  assert.equal(again.ok, false, "one live assessment for one area");
  assert.match(again.ok ? "" : again.error, /already has an assessment/);
  reader();
  assert.equal((await assessments.createAssessment(draft(bishopstown, { subject: "Gym" }))).ok, false, "View cannot write");
});

test("a job comes from the positions, an activity is typed, and each site numbers its own", async () => {
  writer();
  assert.equal((await assessments.createAssessment(draft(bishopstown, { subjectType: "job", subject: "Astronaut" }))).ok, false);
  const job = draft(bishopstown, { subjectType: "job", subject: "lifeguard" });
  assert.equal((await assessments.createAssessment(job)).ok, true);
  assert.equal((await row(job.id)).subject, "Lifeguard", "kept as the list spells it");
  assert.match((await row(job.id)).reference, /-0002$/);
  lifeguard = job.id;
  const activity = draft(bishopstown, { subjectType: "activity", subject: "Handling pool chemicals", ownerId: "" });
  assert.equal((await assessments.createAssessment(activity)).ok, true);
  as("wes", [at(churchfield, "risk.write")]);
  const other = draft(churchfield, { ownerId: "wes" });
  assert.equal((await assessments.createAssessment(other)).ok, true, "the same area at another site");
  assert.match((await row(other.id)).reference, /-0001$/);
});

test("a draft is seen only by those who write at its site", async () => {
  reader();
  await assert.rejects(load.getRiskAssessment(pool), /not available/);
  const seen = await lists.riskLists({});
  assert.deepEqual(seen.views, ["approved", "review", "archived"], "no drafts list without Write");
  assert.equal(seen.rows.length, 0);
  as("wes", [at(churchfield, "risk.write")]);
  await assert.rejects(load.getRiskAssessment(pool), /not available/, "another site's writer");
  writer();
  const mine = await lists.riskLists({ show: "draft" });
  assert.equal(mine.counts.draft, 3);
  assert.ok(mine.rows.every((r) => r.siteId === bishopstown));
  assert.equal((await load.getRiskAssessment(pool)).can.submit, true);
});

let slip = "", chlorine = "";

test("hazards are numbered once and for all, and a stale page is refused", async () => {
  writer();
  slip = await add(pool);
  chlorine = await add(pool, { hazard: "Chlorine gas in the plant room", category: "chemical", inherentLikelihood: 3, inherentSeverity: 5, likelihood: 3, severity: 5, personsAtRisk: ["Staff"] });
  const spare = await add(pool, { hazard: "Loose lane rope" });
  const stale = await version(pool);
  assert.equal((await hazards.removeHazard({ assessmentId: pool, operationId: uuid(), version: stale, hazardId: spare })).ok, true);
  const late = await hazards.addHazard({ assessmentId: pool, operationId: uuid(), version: stale, hazardId: uuid(), ...hazard() });
  assert.match(late.ok ? "" : late.error, /changed while you were looking/);
  const fourth = await add(pool, { hazard: "Diving in the shallow end" });
  const kept = await fixture.prisma.riskHazard.findMany({ where: { assessmentId: pool }, orderBy: { seq: "asc" } });
  assert.deepEqual(kept.map((h) => [h.seq, !!h.removedAt]), [[1, false], [2, false], [3, true], [4, false]], "a removed hazard keeps its number");
  assert.equal(kept.find((h) => h.id === chlorine)!.score, 15);
  assert.equal(kept.find((h) => h.id === slip)!.personsAtRisk, "Customers, Children");

  const edit = { assessmentId: pool, operationId: uuid(), version: await version(pool), hazardId: fourth, ...hazard({ hazard: "Diving in the shallow end", likelihood: 1, severity: 4 }) };
  assert.equal((await hazards.editHazard(edit)).ok, true);
  assert.equal((await hazards.editHazard(edit)).ok, true, "a second press");
  const unchanged = await hazards.editHazard({ ...edit, operationId: uuid(), version: await version(pool) });
  assert.match(unchanged.ok ? "" : unchanged.error, /Nothing has changed/);
  assert.equal((await hazards.editHazard({ ...edit, operationId: uuid(), version: await version(pool), hazardId: spare })).ok, false, "a removed hazard");
  reader();
  assert.equal((await hazards.addHazard({ assessmentId: pool, operationId: uuid(), version: await version(pool), hazardId: uuid(), ...hazard() })).ok, false, "View cannot change hazards");
  writer();
  const page = await load.getRiskAssessment(pool);
  assert.deepEqual(page.hazards.map((h) => h.reference.slice(-6)), ["HZ-001", "HZ-002", "HZ-004"]);
  assert.equal(page.highest, 15);
  assert.equal(page.overall, Math.round((6 + 15 + 4) / 3));
});

test("its owner signs it off; the executive sign-off comes from someone else with that tick", async () => {
  writer();
  const empty = await move(lifeguard, "submit");
  assert.match(empty.ok ? "" : empty.error, /at least one hazard/);
  assert.equal((await move(pool, "owner_approve")).ok, false, "not before it is sent");
  assert.deepEqual(await move(pool, "submit"), { ok: true, id: pool });
  assert.equal((await row(pool)).status, "review");

  reader();
  assert.equal((await load.getRiskAssessment(pool)).can.request, true, "now readers see it");
  as("wes", [at(bishopstown, "risk.write")]);
  const notOwner = await move(pool, "owner_approve");
  assert.match(notOwner.ok ? "" : notOwner.error, /Only its owner, orla,/);
  executive();
  assert.equal((await move(pool, "exec_approve")).ok, false, "not before the owner");

  writer();
  assert.deepEqual(await move(pool, "owner_approve"), { ok: true, id: pool });
  const signed = await row(pool);
  assert.equal(signed.status, "approved");
  assert.equal(signed.ownerApprovedByName, "orla");
  assert.equal((await move(pool, "exec_approve")).ok, false, "the owner holds no executive tick");
  as("orla", [at(bishopstown, "risk.write", "risk.signoff")]);
  const own = await move(pool, "exec_approve");
  assert.match(own.ok ? "" : own.error, /other than the owner/);
  executive();
  assert.deepEqual(await move(pool, "exec_approve"), { ok: true, id: pool });
  assert.equal((await row(pool)).execApprovedByName, "ed");
  assert.equal((await row(pool)).status, "approved", "it never changes the status");
  const can = (await load.getRiskAssessment(pool)).can;
  assert.deepEqual([can.execWithdraw, can.execApprove, can.write, can.review], [true, false, false, false]);
});

test("changing what was signed off clears the sign-off and waits for it again", async () => {
  writer();
  await add(pool, { hazard: "Glare on the water surface", likelihood: 2, severity: 2 });
  const changed = await row(pool);
  assert.equal(changed.status, "review");
  assert.deepEqual([changed.ownerApprovedAt, changed.execApprovedAt, changed.execApprovedByName], [null, null, null]);
  assert.deepEqual((await events(pool)).slice(-2), ["hazard_add", "signoff_reset"]);
  assert.equal((await move(pool, "owner_approve")).ok, true);

  const details = { id: pool, operationId: uuid(), version: await version(pool), subjectType: "area" as const, subject: "Main pool", scope: "Public swimming, lessons and galas", departmentId: "", ownerId: "orla", assessorName: "", assessedOn: changed.assessedOn, reviewMonths: 6, targetScore: 8 };
  assert.deepEqual(await assessments.editAssessment(details), { ok: true, id: pool });
  const edited = await row(pool);
  assert.equal(edited.status, "review");
  assert.equal(edited.nextReviewOn, addMonthsIso(changed.assessedOn, 6));
  const note = await fixture.prisma.riskEvent.findFirstOrThrow({ where: { assessmentId: pool, action: "edit" } });
  assert.equal(note.note, "Changed: what it covers, how often it is reviewed");
  const same = await assessments.editAssessment({ ...details, operationId: uuid(), version: await version(pool) });
  assert.match(same.ok ? "" : same.error, /Nothing has changed/);
  const clash = await assessments.editAssessment({ ...details, operationId: uuid(), version: await version(pool), subjectType: "job", subject: "Lifeguard" });
  assert.match(clash.ok ? "" : clash.error, /already has an assessment/);
  assert.equal((await move(pool, "owner_approve")).ok, true);
});

test("reviews are logged on assessments in force, and the next one moves on from that day", async () => {
  writer();
  const day = today();
  const notYet = await reviews.logReview({ id: lifeguard, operationId: uuid(), version: await version(lifeguard), reviewedOn: day, outcome: "no_changes", notes: "" });
  assert.match(notYet.ok ? "" : notYet.error, /in force/);
  await fixture.prisma.riskAssessment.update({ where: { id: pool }, data: { nextReviewOn: addDaysIso(day, -9) } });

  const queue = await due.reviewsDue({});
  assert.deepEqual(queue.overdue.map((r) => r.id), [pool]);
  assert.equal(queue.overdue[0].review.days, -9);
  const viewer = (perms: string[]) => ({ id: state.id, name: state.id, permissions: perms, anywhere: perms, isSuperadmin: false });
  const waiting = await home.riskHomeItems(viewer(["risk.write"]));
  const overdue = waiting.find((i) => i.label === "Risk assessment reviews overdue");
  assert.deepEqual([overdue?.count, overdue?.attention], [1, true]);
  assert.ok(waiting.some((i) => i.kind === "action" && i.href === "/risk-assessments/new"));
  reader();
  assert.deepEqual(await home.riskHomeItems(viewer(["risk.read"])), [], "nothing waits on a reader");
  assert.deepEqual(await home.riskHomeItems(viewer([])), []);
  assert.equal((await reviews.logReview({ id: pool, operationId: uuid(), version: await version(pool), reviewedOn: day, outcome: "no_changes", notes: "" })).ok, false, "View cannot log one");

  writer();
  assert.equal((await reviews.logReview({ id: pool, operationId: uuid(), version: await version(pool), reviewedOn: addDaysIso(day, 1), outcome: "no_changes", notes: "" })).ok, false, "a day in the future");
  const log = { id: pool, operationId: uuid(), version: await version(pool), reviewedOn: day, outcome: "updated" as const, notes: "Signs replaced" };
  assert.deepEqual(await reviews.logReview(log), { ok: true, id: pool });
  assert.deepEqual(await reviews.logReview(log), { ok: true, id: pool }, "a second press");
  assert.equal(await fixture.prisma.riskReview.count({ where: { assessmentId: pool } }), 1);
  const reviewed = await row(pool);
  assert.deepEqual([reviewed.lastReviewedOn, reviewed.nextReviewOn, reviewed.status], [day, addMonthsIso(day, 6), "approved"]);
  assert.equal((await due.reviewsDue({})).overdueCount, 0);
  const earlier = await reviews.logReview({ ...log, operationId: uuid(), version: await version(pool), reviewedOn: addDaysIso(day, -3) });
  assert.match(earlier.ok ? "" : earlier.error, /later review is already logged/);
});

test("anyone who reads asks for another look; writers answer, once", async () => {
  reader();
  const before = await version(pool);
  assert.equal((await reviews.askForReview({ id: pool, operationId: uuid(), hazardId: "", notes: "x" })).ok, false, "say why");
  assert.equal((await reviews.askForReview({ id: lifeguard, operationId: uuid(), hazardId: "", notes: "Rota has changed" })).ok, false, "a draft is not theirs to see");
  const ask = { id: pool, operationId: uuid(), hazardId: slip, notes: "The matting by the steps has worn through" };
  assert.deepEqual(await reviews.askForReview(ask), { ok: true, id: pool });
  assert.deepEqual(await reviews.askForReview(ask), { ok: true, id: pool }, "a second press");
  assert.equal(await version(pool), before, "asking leaves the assessment as it was");
  const [request] = await fixture.prisma.riskReviewRequest.findMany({ where: { assessmentId: pool } });
  assert.deepEqual([request.status, request.hazardId, request.requestedByName, request.siteId], ["open", slip, "sam", bishopstown]);
  assert.equal((await reviews.answerRequest({ requestId: request.id, operationId: uuid(), answer: "actioned", note: "" })).ok, false, "View cannot answer");
  const page = await load.getRiskAssessment(pool);
  assert.match(page.requests[0].hazardLabel, /HZ-001$/);

  writer();
  assert.equal((await due.reviewsDue({})).requestCount, 1);
  const noReason = await reviews.answerRequest({ requestId: request.id, operationId: uuid(), answer: "dismissed", note: "" });
  assert.match(noReason.ok ? "" : noReason.error, /why/);
  assert.equal((await reviews.answerRequest({ requestId: request.id, operationId: uuid(), answer: "actioned", note: "New matting laid" })).ok, true);
  const twice = await reviews.answerRequest({ requestId: request.id, operationId: uuid(), answer: "dismissed", note: "Already done" });
  assert.match(twice.ok ? "" : twice.error, /already answered/);
  const answered = await fixture.prisma.riskReviewRequest.findUniqueOrThrow({ where: { id: request.id } });
  assert.deepEqual([answered.status, answered.resolvedByName, answered.resolutionNote], ["actioned", "orla", "New matting laid"]);
  assert.equal((await due.reviewsDue({})).requestCount, 0);
});

test("the high-risk list and the hazard register hold hazards on assessments in use, at the person's sites", async () => {
  reader();
  const high = await highRisk.highRiskHazards({});
  assert.deepEqual(high.rows.map((h) => [h.id, h.score]), [[chlorine, 15]]);
  assert.equal(high.rows[0].subject, "Main pool");
  as("wes", [at(churchfield, "risk.read")]);
  assert.equal((await highRisk.highRiskHazards({})).total, 0, "another site");

  writer();
  await add(lifeguard, { hazard: "Wet floor in the lifeguard room", likelihood: 4, severity: 4 });
  assert.equal((await highRisk.highRiskHazards({})).total, 1, "a draft's hazards do not count yet");
  const found = await register.searchHazards(bishopstown, "wet floor", "Main pool");
  assert.deepEqual(found.map((h) => h.id), [slip], "the draft's hazard is not offered");
  assert.match(found[0].reference, /-HZ-001$/);
  assert.equal(found[0].href, `/risk-assessments/${pool}`);
  assert.match(found[0].assessment, /Main pool$/);
  assert.equal((await register.searchHazards(bishopstown, "")).length, 4);
  assert.equal((await register.searchHazards(churchfield, "")).length, 0);
  assert.deepEqual((await register.hazardsByIds(bishopstown, [slip, "nothing"])).map((h) => h.id), [slip]);
  assert.deepEqual(await register.hazardsByIds(churchfield, [slip]), [], "only at its own site");
});

test("an incident that names hazards raises one review request on each assessment", async () => {
  const event = { orgId: ORG, siteId: bishopstown, incidentId: "inc-1", incident: "INC-00042", operationId: uuid(), hazardIds: [slip, chlorine], note: "Controls did not hold", flaggedById: "mia", flaggedByName: "mia" };
  assert.equal(await incident.raiseFromIncident(event), 1, "two hazards on one assessment, one request");
  assert.equal(await incident.raiseFromIncident(event), 0, "announced again");
  assert.equal(await incident.raiseFromIncident({ ...event, operationId: uuid(), hazardIds: [slip] }), 0, "still one to answer from that incident");
  const request = await fixture.prisma.riskReviewRequest.findFirstOrThrow({ where: { sourceIncidentId: "inc-1" } });
  assert.deepEqual([request.assessmentId, request.hazardId, request.requestedByName, request.sourceIncidentRef, request.status], [pool, null, "mia", "INC-00042", "open"]);
  assert.match(request.notes, /^Linked to incident INC-00042 \(.*HZ-001, .*HZ-002\)\. Controls did not hold$/);
  assert.equal(await incident.raiseFromIncident({ ...event, operationId: uuid(), siteId: churchfield }), 0, "a hazard is flagged only at its own site");
  assert.equal(await incident.raiseFromIncident({ ...event, operationId: uuid(), incidentId: "inc-2", incident: "INC-00043", hazardIds: [chlorine] }), 1, "another incident");
  const one = await fixture.prisma.riskReviewRequest.findFirstOrThrow({ where: { sourceIncidentId: "inc-2" } });
  assert.equal(one.hazardId, chlorine, "about that one hazard");
  assert.equal((await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "RiskAssessment", action: "request", actorId: "mia" } })).clubId, bishopstown);
});

test("Manage archives and brings back; an archived assessment is not changed", async () => {
  writer();
  assert.equal((await move(pool, "archive")).ok, false, "Write cannot archive");
  manager();
  assert.deepEqual(await move(pool, "archive", "Pool hall closed for refit"), { ok: true, id: pool });
  assert.deepEqual([(await row(pool)).status, (await row(pool)).archivedFrom], ["archived", "approved"]);
  assert.equal((await highRisk.highRiskHazards({})).total, 0);
  assert.equal((await register.searchHazards(bishopstown, "")).length, 0);
  const frozen = await hazards.addHazard({ assessmentId: pool, operationId: uuid(), version: await version(pool), hazardId: uuid(), ...hazard() });
  assert.match(frozen.ok ? "" : frozen.error, /archived/);
  assert.equal((await lists.riskLists({ show: "archived" })).counts.archived, 1);

  const replacement = draft(bishopstown, { subject: "Main pool" });
  assert.equal((await assessments.createAssessment(replacement)).ok, true, "the area is free again");
  const blocked = await move(pool, "restore");
  assert.match(blocked.ok ? "" : blocked.error, /Another assessment now covers this/);
  assert.equal((await move(replacement.id, "archive")).ok, true);
  assert.deepEqual(await move(pool, "restore"), { ok: true, id: pool });
  assert.equal((await row(pool)).status, "approved", "back where it stood, sign-off and all");
});

test("what is held about a person, and a renamed area", async () => {
  const records = await people.riskSubjectRecords("orla", ORG);
  assert.ok(records.assessments.some((a) => a.about === "Main pool" && a.as.includes("owner") && a.as.includes("signed it off")));
  assert.equal(records.reviews.length, 1);
  assert.equal((await people.riskSubjectRecords("sam", ORG)).reviewRequests.length, 1);
  assert.deepEqual((await people.riskSubjectRecords("sam", "another-org")).assessments, []);
  assert.equal(await people.renameRiskAreas({ siteId: bishopstown, from: "main pool", to: "25m pool" }), 2, "the live one and the archived one");
  assert.equal((await row(pool)).subject, "25m pool");
  assert.equal(await fixture.prisma.riskAssessment.count({ where: { siteId: churchfield, subject: "Main pool" } }), 1, "another site's area keeps its name");
});

test("every change left an audit row", async () => {
  const [steps, audit] = await Promise.all([fixture.prisma.riskEvent.count(), fixture.prisma.auditLog.count({ where: { entity: "RiskAssessment" } })]);
  assert.equal(audit, steps);
});
