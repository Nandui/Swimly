import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { addDaysIso, today } from "@/lib/format";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";

/** Incidents end to end on an isolated database: reporting at your own sites,
 *  serious alerts, who sees what, triage and sign-off by someone else, and the
 *  audit trail. Invented people only. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let report: typeof import("../features/report/server/actions");
let triage: typeof import("../features/triage/server/actions");
let data: typeof import("../features/reports/server/data");
let work: typeof import("../features/investigation/server/actions");
let mineData: typeof import("../features/investigation/server/data");
let emails: typeof import("../features/investigation/server/emails");
let files: typeof import("../features/files/server/files");
let insights: typeof import("../features/insights/server/data");
let exporter: typeof import("../features/export/server/data");
let staff: typeof import("../features/staff/server/file");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "mia", permissions: [] as string[], grants: [] as GrantRow[] };
let bishopstown = "", churchfield = "";

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: ["incidents"], primaryScreens: ["incidents"], grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
class NotFound extends Error {}
const as = (id: string, permissions: string[], grants: GrantRow[] = []) => Object.assign(state, { id, permissions, grants });
const at = (siteId: string, permissions: string[]): GrantRow => ({ roleName: "Site", permissions, screens: ["incidents"], scopeKind: "site", scopeId: siteId });
const nearMiss = () => ({ siteId: bishopstown, area: "Main pool", kind: "near_miss" as const, category: "slip_trip_fall" as const, occurredOn: "2026-10-01", occurredAt: "10:15",
  description: "Puddle by the slide steps with no wet floor sign.", immediateAction: "Mopped and sign put out.", raisedBy: "Aoife, lifeguard", people: [], witnesses: [] });

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const clubs = await db.club.findMany({ where: { orgId: ORG }, orderBy: { name: "asc" } });
  bishopstown = clubs.find((c) => c.name.includes("Bishopstown"))!.id;
  churchfield = clubs.find((c) => c.name.includes("Churchfield"))!.id;
  await db.staffRole.create({ data: { id: "r-life", name: "Lifeguard", permissions: ["incidents.reports.create"], screens: [] } });
  await db.staffRole.create({ data: { id: "r-duty", name: "Centre manager", permissions: ["incidents.reports.review", "incidents.reports.create"], screens: [] } });
  await db.staffRole.create({ data: { id: "r-gm", name: "General manager", permissions: ["incidents.reports.signoff", "incidents.reports.review", "incidents.reports.create"], screens: [] } });
  for (const [id, role, sites] of [["mia", "r-life", []], ["dan", "r-duty", []], ["gina", "r-gm", []], ["carl", "r-gm", ["churchfield"]]] as const) {
    await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: role, orgId: ORG, siteIds: sites.map(() => churchfield) } });
  }
  const d = {
    "@/lib/prisma": { prisma: fixture.prisma },
    "@/lib/authz": {
      AuthorizationError: class AuthorizationError extends Error {},
      requireSession: async () => session(),
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: () => true,
    },
    "@/lib/clubs/current": { currentClubId: async () => bishopstown, currentClubIdIfAny: async () => bishopstown },
    "next/cache": { revalidatePath() {} },
    "next/headers": { headers: async () => new Headers({ host: "turnfin.example.test", "x-forwarded-proto": "https" }) },
    "next/navigation": { notFound: () => { throw new NotFound("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  report = serverModule("src/modules/incidents/features/report/server/actions.ts", d);
  triage = serverModule("src/modules/incidents/features/triage/server/actions.ts", d);
  data = serverModule("src/modules/incidents/features/reports/server/data.ts", d);
  work = serverModule("src/modules/incidents/features/investigation/server/actions.ts", d);
  mineData = serverModule("src/modules/incidents/features/investigation/server/data.ts", d);
  emails = serverModule("src/modules/incidents/features/investigation/server/emails.ts", d);
  files = serverModule("src/modules/incidents/features/files/server/files.ts", d);
  insights = serverModule("src/modules/incidents/features/insights/server/data.ts", d);
  exporter = serverModule("src/modules/incidents/features/export/server/data.ts", d);
  staff = serverModule("src/modules/incidents/features/staff/server/file.ts", d);
});
after(async () => { await fixture?.close(); });

const reporter = () => as("mia", [], [at(bishopstown, ["incidents.reports.create"])]);
const duty = () => as("dan", [], [at(bishopstown, ["incidents.reports.review"])]);

test("a near miss: reported at your own site, triaged and closed by someone else", async () => {
  reporter();
  assert.equal((await report.submitReport({ ...nearMiss(), siteId: churchfield })).ok, false, "only the sites your role covers");
  const sent = await report.submitReport(nearMiss());
  assert.ok(sent.ok && sent.id);
  const row = await fixture.prisma.incidentReport.findUniqueOrThrow({ where: { id: sent.id! } });
  assert.deepEqual([row.status, row.serious, row.reporterName, row.raisedBy], ["reported", false, "mia", "Aoife, lifeguard"]);
  assert.equal((await triage.triageReport(row.id, row.version, { severityActual: 1, severityPotential: 2, staffOffOver3Days: false, publicToDoctor: false, deathOrDangerous: false, parentInformed: "", outcome: "close", note: "Fine" })).ok, false, "not your own, and not without access");

  duty();
  assert.equal((await data.incidentCounts()).toTriage, 1);
  assert.equal((await triage.triageReport(row.id, row.version + 1, { severityActual: 1, severityPotential: 2, staffOffOver3Days: false, publicToDoctor: false, deathOrDangerous: false, parentInformed: "", outcome: "close", note: "Fine" })).ok, false, "a stale version");
  assert.equal((await triage.triageReport(row.id, row.version, { severityActual: 1, severityPotential: 2, staffOffOver3Days: false, publicToDoctor: false, deathOrDangerous: false, parentInformed: "", outcome: "close", note: "Sign put back; told the team at the huddle." })).ok, true);
  const closed = await fixture.prisma.incidentReport.findUniqueOrThrow({ where: { id: row.id } });
  assert.deepEqual([closed.status, closed.closedByName], ["closed", "dan"]);

  reporter();
  const theft = await report.submitReport({ ...nearMiss(), kind: "incident", category: "security", description: "A phone was taken from an unlocked locker in the changing village." });
  assert.ok(theft.ok && theft.id);
  duty();
  const t = await fixture.prisma.incidentReport.findUniqueOrThrow({ where: { id: theft.id! } });
  assert.equal((await triage.triageReport(t.id, t.version, { severityActual: 2, severityPotential: 2, staffOffOver3Days: false, publicToDoctor: false, deathOrDangerous: false, parentInformed: "",
    answers: { whose: "customer", gardaiTold: true, gardaiRef: "20261019-0042", cctvKept: true, poolClosed: true }, outcome: "close", note: "Locker sign checked." })).ok, true);
  assert.deepEqual((await fixture.prisma.incidentReport.findUniqueOrThrow({ where: { id: t.id } })).triageAnswers, { whose: "customer", gardaiTold: true, gardaiRef: "20261019-0042", cctvKept: true }, "a theft keeps its own questions");

  reporter();
  const mine = await data.incidentReport(row.id);
  assert.equal(mine.report.closeNote, "Sign put back; told the team at the huddle.", "the reporter sees the outcome");
  assert.equal((await report.addAddendum(row.id, "The sign had been moved by a class.")).ok, true, "added to after closing");

  const log = await fixture.prisma.auditLog.findMany({ where: { entity: "IncidentReport", entityId: row.id }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(log.map((l) => l.action), ["submit", "triage", "close", "addendum"]);
  assert.ok(log.every((l) => l.module === "Incidents" && l.clubId === bishopstown));
});

test("a serious accident alerts everyone who triages at the site, and only a manager closes it", async () => {
  reporter();
  const child = { type: "swimmer" as const, ageGroup: "child" as const, name: "Sample Child", contact: "", injured: true, bodyPart: "Head", injury: "Bump", firstAid: "Cold compress", firstAidBy: "mia", ambulance: false, hospital: true };
  const sent = await report.submitReport({ ...nearMiss(), kind: "accident", category: "struck", people: [child] });
  assert.ok(sent.ok);
  const row = await fixture.prisma.incidentReport.findUniqueOrThrow({ where: { id: sent.id! }, include: { notifications: true } });
  assert.equal(row.serious, true);
  // Dan and Gina cover every site; Carl only Churchfield. No email is set up in tests, so each job records why.
  assert.deepEqual(row.notifications.map((n) => [n.recipientId, n.status, n.error]).sort(), [["dan", "FAILED", "Email is not set up."], ["gina", "FAILED", "Email is not set up."]]);

  as("dan", [], [at(churchfield, ["incidents.reports.review"])]);
  await assert.rejects(data.incidentReport(row.id), NotFound, "not at the sites they triage");

  duty();
  const t = { severityActual: 3, severityPotential: 4, staffOffOver3Days: false, publicToDoctor: true, deathOrDangerous: false, parentInformed: "", outcome: "investigate" as const, note: "Hit the slide rail." };
  assert.equal((await triage.triageReport(row.id, row.version, t)).ok, false, "a child: say who told the parent");
  assert.equal((await triage.triageReport(row.id, row.version, { ...t, parentInformed: "Dan, by phone at 10:40" })).ok, true);
  const seen = await data.incidentReport(row.id);
  assert.equal(seen.can.close, false, "moderate and worse need a manager");
  assert.equal(await fixture.prisma.incidentAccessEvent.count({ where: { reportId: row.id, actorId: "dan" } }), 1, "opening the injury details is logged");

  const triaged = await fixture.prisma.incidentReport.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal((await work.saveInvestigation(row.id, triaged.version, { whys: ["The rail had no padding"], rootCause: "Rail padding was never fitted." })).ok, true);

  as("gina", ["incidents.reports.signoff"]);
  assert.equal((await data.incidentCounts()).toSignOff, 1);
  const version = (await fixture.prisma.incidentReport.findUniqueOrThrow({ where: { id: row.id } })).version;
  assert.equal((await triage.closeReport(row.id, version, { note: "Rail padded and checked.", hsaReference: "" })).ok, false, "the HSA reference first");
  assert.equal((await triage.closeReport(row.id, version, { note: "Rail padded and checked.", hsaReference: "IR1 sent 2026-10-05" })).ok, true);
  assert.equal((await data.incidentReport(row.id)).reads.length, 2, "the manager sees who opened it");
});

test("an investigation: statements, root cause and actions before closing, the owner's own Done, and a reopen", async () => {
  reporter();
  const sent = await report.submitReport(nearMiss());
  assert.ok(sent.ok);
  const id = sent.id!;
  const version = async () => (await fixture.prisma.incidentReport.findUniqueOrThrow({ where: { id } })).version;
  duty();
  assert.equal((await triage.triageReport(id, await version(), { severityActual: 2, severityPotential: 3, staffOffOver3Days: false, publicToDoctor: false, deathOrDangerous: false, parentInformed: "", outcome: "investigate", note: "Could have been a head injury." })).ok, true);

  reporter();
  const statement = { givenBy: "Aoife", givenAs: "lifeguard on the slide", takenOn: "2026-10-02", text: "The sign was by the office, not at the steps." };
  assert.equal((await work.addStatement(id, statement)).ok, false, "the reporter does not investigate");
  duty();
  assert.equal((await work.addStatement(id, { ...statement, takenOn: "2026-09-30" })).ok, false, "not before it happened");
  assert.equal((await work.addStatement(id, statement)).ok, true);
  const stale = await version() - 1;
  assert.equal((await work.saveInvestigation(id, stale, { whys: ["Wet step"], rootCause: "x" })).ok, false, "a stale version");
  assert.equal((await work.saveInvestigation(id, await version(), { whys: ["The step was wet", "", "No sign at the steps", "", ""], rootCause: "Nobody owns the sign between sessions." })).ok, true);
  const tomorrow = addDaysIso(today(), 1);
  assert.equal((await work.raiseAction(id, { title: "Add the slide steps to the hourly check", ownerId: "carl", dueOn: tomorrow })).ok, false, "the owner works at the site");
  assert.equal((await work.raiseAction(id, { title: "Add the slide steps to the hourly check", ownerId: "mia", dueOn: tomorrow })).ok, true);
  const action = await fixture.prisma.incidentAction.findFirstOrThrow({ where: { reportId: id } });
  assert.deepEqual([action.ownerName, action.status, !!action.assignedEmailAt, action.emailError], ["mia", "open", true, "Email is not set up."], "the owner is emailed, and a failure is kept");
  const saved = await fixture.prisma.incidentReport.findUniqueOrThrow({ where: { id } });
  assert.deepEqual(saved.whys, ["The step was wet", "No sign at the steps"]);

  as("gina", ["incidents.reports.signoff"]);
  const blocked = await triage.closeReport(id, await version(), { note: "Hourly check now covers the steps.", hsaReference: "" });
  assert.match(blocked.ok ? "" : blocked.error, /still open/);

  reporter();
  const mineList = await mineData.yourActions();
  assert.equal(mineList.rows.length, 1, "the owner sees their action");
  const seen = await data.incidentReport(id);
  assert.deepEqual([seen.report.statements.length, seen.report.actions.length, seen.report.rootCause], [0, 0, ""], "the reporter sees the outcome, not the working");
  assert.equal((await work.finishAction(action.id, { outcome: "cancelled", note: "Not needed" })).ok, false, "an owner can't cancel");
  assert.equal((await work.finishAction(action.id, { outcome: "done", note: "Added to the hourly sheet." })).ok, true);
  assert.equal((await work.finishAction(action.id, { outcome: "done", note: "Again" })).ok, false, "once");

  as("gina", ["incidents.reports.signoff"]);
  assert.equal((await triage.closeReport(id, await version(), { note: "Hourly check now covers the steps.", hsaReference: "" })).ok, true);
  duty();
  assert.equal((await work.reopenReport(id, await version(), "The step was wet again on Friday.")).ok, false, "only a manager reopens");
  as("gina", ["incidents.reports.signoff"]);
  assert.equal((await work.reopenReport(id, await version(), "The step was wet again on Friday.")).ok, true);
  const reopened = await fixture.prisma.incidentReport.findUniqueOrThrow({ where: { id } });
  assert.deepEqual([reopened.status, reopened.closedAt], ["investigating", null]);

  const log = await fixture.prisma.auditLog.findMany({ where: { entity: "IncidentReport", entityId: id }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(log.map((l) => l.action), ["submit", "triage", "statement", "investigation", "action_add", "action_done", "close", "reopen"]);
});

test("action reminders go once: the day before it is due, and after it was due", async () => {
  reporter();
  const sent = await report.submitReport(nearMiss());
  duty();
  const id = sent.id!;
  const row = await fixture.prisma.incidentReport.findUniqueOrThrow({ where: { id } });
  await triage.triageReport(id, row.version, { severityActual: 2, severityPotential: 2, staffOffOver3Days: false, publicToDoctor: false, deathOrDangerous: false, parentInformed: "", outcome: "investigate", note: "Worth a look." });
  await work.raiseAction(id, { title: "Replace the step edging", ownerId: "dan", dueOn: addDaysIso(today(), 1) });
  await work.raiseAction(id, { title: "Retrain the late shift", ownerId: "dan", dueOn: today() });
  await fixture.prisma.incidentAction.updateMany({ where: { reportId: id, title: "Retrain the late shift" }, data: { dueOn: addDaysIso(today(), -2) } });
  const first = await emails.runActionReminders("https://turnfin.example.test");
  assert.equal(first.sent + first.failed, 2, "one due tomorrow, one overdue");
  const again = await emails.runActionReminders("https://turnfin.example.test");
  assert.equal(again.sent + again.failed, 0, "nothing twice");
  assert.equal((await data.incidentCounts()).overdueActions, 1);
});

test("photos: the reporter and investigators add them, anyone who may read opens them, and opening is logged", async () => {
  reporter();
  const sent = await report.submitReport(nearMiss());
  const id = sent.id!;
  const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])], "steps.png", { type: "image/png" });
  const mia = { id: "mia", name: "mia", orgId: ORG, superadmin: false, review: false, signoff: false };
  const dan = { ...mia, id: "dan", name: "dan", review: true };
  const outsider = { ...mia, id: "olga", name: "olga" };
  await files.addFile(mia, id, png);
  await assert.rejects(files.addFile(mia, id, new File(["<svg/>"], "x.png", { type: "image/png" })), /photo/);
  await assert.rejects(files.addFile(outsider, id, png), /reporter/);
  const stored = await fixture.prisma.incidentFile.findFirstOrThrow({ where: { reportId: id } });
  duty();
  assert.equal((await files.readFile(dan, stored.id)).name, "steps.png");
  assert.equal(await fixture.prisma.incidentAccessEvent.count({ where: { reportId: id, actorId: "dan" } }), 1);
  await assert.rejects(files.readFile(outsider, stored.id), /not available/);
  await files.removeFile(dan, stored.id);
  await assert.rejects(files.readFile(mia, stored.id), /not available/);
});

test("a staff injury reaches their HR file, the insights count it, and only a manager opens the full record", async () => {
  reporter();
  const hurt = { type: "staff" as const, ageGroup: "adult" as const, name: "", userId: "dan", contact: "", injured: true, bodyPart: "left hand", injury: "cut", firstAid: "Plaster", firstAidBy: "mia", ambulance: false, hospital: false };
  const stranger = { ...hurt, userId: "nobody-here", bodyPart: "", injury: "" };
  const sent = await report.submitReport({ ...nearMiss(), kind: "accident", category: "struck", occurredAt: "16:40", people: [hurt, stranger] });
  assert.ok(sent.ok);
  const id = sent.id!;
  const people = await fixture.prisma.incidentPerson.findMany({ where: { reportId: id }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(people.map((p) => p.userId), ["dan", null], "only someone on the site's team is linked");
  const file = await staff.staffIncidentFile("dan", ORG);
  assert.equal(file.entries.length, 1);
  assert.match(file.entries[0].detail, /cut, left hand; first aid given/);
  assert.equal((await staff.staffIncidentRecords("dan", ORG)).involved.length, 1);

  await assert.rejects(insights.incidentInsights({}), NotFound, "insights are for those who triage");
  duty();
  const seen = await insights.incidentInsights({ months: "3" });
  assert.equal(seen.months, 3);
  assert.ok(seen.insights.total >= 1);
  assert.ok((seen.insights.kinds.find((k) => k.key === "accident")?.count ?? 0) >= 1);
  assert.ok((seen.insights.hours.find((h) => h.key === "16:00")?.count ?? 0) >= 1, "counted at the hour it happened");
  assert.equal(seen.toReview, null, "the keeping list is for Manage");
  await assert.rejects(exporter.incidentExport(id), NotFound, "Investigate cannot open the full record");

  as("gina", [], [at(bishopstown, ["incidents.reports.signoff", "incidents.reports.review", "incidents.reports.create"])]);
  const full = await exporter.incidentExport(id);
  assert.equal(full.report.people.length, 2);
  assert.equal(await fixture.prisma.incidentEvent.count({ where: { reportId: id, action: "export" } }), 1, "every opening is in the history");
  assert.deepEqual((await insights.incidentInsights({})).toReview, [], "nothing is past its keeping period yet");
});
