import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";

/** Incidents end to end on an isolated database: reporting at your own sites,
 *  serious alerts, who sees what, triage and sign-off by someone else, and the
 *  audit trail. Invented people only. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let report: typeof import("../features/report/server/actions");
let triage: typeof import("../features/triage/server/actions");
let data: typeof import("../features/reports/server/data");
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

  as("gina", ["incidents.reports.signoff"]);
  assert.equal((await data.incidentCounts()).toSignOff, 1);
  const version = (await fixture.prisma.incidentReport.findUniqueOrThrow({ where: { id: row.id } })).version;
  assert.equal((await triage.closeReport(row.id, version, { note: "Rail padded and checked.", hsaReference: "" })).ok, false, "the HSA reference first");
  assert.equal((await triage.closeReport(row.id, version, { note: "Rail padded and checked.", hsaReference: "IR1 sent 2026-10-05" })).ok, true);
  assert.equal((await data.incidentReport(row.id)).reads.length, 2, "the manager sees who opened it");
});
