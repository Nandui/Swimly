import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import type { AssessedHazard, HazardRegister } from "@/modules/contributions";

/** Hazards on a report, on an isolated database with the hazard register faked (it is another
 *  app's): only those who triage at the site link them; each link keeps the hazard's words and
 *  lands in the report's history and the activity log; asking for a review is announced once the
 *  links are saved; a closed report takes none; and with no register, nothing is offered. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let report: typeof import("../features/report/server/actions");
let triage: typeof import("../features/triage/server/actions");
let actions: typeof import("../features/hazards/server/actions");
let links: typeof import("../features/hazards/server/links");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "mia", permissions: [] as string[], grants: [] as GrantRow[] };
let bishopstown = "", churchfield = "";
let registerOn = true;
const announced: { name: string; payload: Record<string, unknown> }[] = [];
const asked: { siteId: string; q: string; area?: string }[] = [];

const assessed = (id: string, hazard: string): AssessedHazard => ({ id, reference: `RA-BT-0001-HZ-00${id.slice(-1)}`, hazard, assessment: "RA-BT-0001 Main pool", score: 6, href: "/risk-assessments/a1" });
const HAZARDS = [assessed("hz-1", "Wet floor at the pool edge"), assessed("hz-2", "Diving in the shallow end")];
const fake: HazardRegister = {
  app: "risk",
  search: async (siteId, q, area) => { asked.push({ siteId, q, area }); return siteId === bishopstown ? HAZARDS.filter((h) => h.hazard.toLowerCase().includes(q.toLowerCase())) : []; },
  byIds: async (siteId, ids) => (siteId === bishopstown ? HAZARDS.filter((h) => ids.includes(h.id)) : []),
};

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: ["incidents"], primaryScreens: ["incidents"], grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
const as = (id: string, grants: GrantRow[]) => Object.assign(state, { id, permissions: [], grants });
const at = (siteId: string, permissions: string[]): GrantRow => ({ roleName: "Site", permissions, screens: ["incidents"], scopeKind: "site", scopeId: siteId });
const reporter = () => as("mia", [at(bishopstown, ["incidents.reports.create"])]);
const duty = () => as("dan", [at(bishopstown, ["incidents.reports.review"])]);
const link = (hazardIds: string[], extra: Record<string, unknown> = {}) => ({ operationId: crypto.randomUUID(), hazardIds, note: "", askReview: false, ...extra });
let reportId = "";

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const clubs = await db.club.findMany({ where: { orgId: ORG }, orderBy: { name: "asc" } });
  bishopstown = clubs.find((c) => c.name.includes("Bishopstown"))!.id;
  churchfield = clubs.find((c) => c.name.includes("Churchfield"))!.id;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["mia", "dan"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG } });
  const d = {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": {
      AuthorizationError: class AuthorizationError extends Error {},
      requireSession: async () => session(),
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: () => true,
    },
    "@/lib/clubs/current": { currentClubId: async () => bishopstown, currentClubIdIfAny: async () => bishopstown },
    "@/modules/contributions": {
      hazardRegister: async () => (registerOn ? fake : null),
      announce: async (name: string, payload: Record<string, unknown>) => { announced.push({ name, payload }); },
    },
    "next/cache": { revalidatePath() {} },
    "next/headers": { headers: async () => new Headers({ host: "turnfin.example.test", "x-forwarded-proto": "https" }) },
    "next/server": { after() {} },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  report = serverModule("src/modules/incidents/features/report/server/actions.ts", d);
  triage = serverModule("src/modules/incidents/features/triage/server/actions.ts", d);
  actions = serverModule("src/modules/incidents/features/hazards/server/actions.ts", d);
  links = serverModule("src/modules/incidents/features/hazards/server/links.ts", d);

  reporter();
  const sent = await report.submitReport({ siteId: bishopstown, area: "Main pool", kind: "near_miss", category: "slip_trip_fall", occurredOn: "2026-10-01", occurredAt: "10:15",
    description: "Puddle by the slide steps with no wet floor sign.", immediateAction: "Mopped and sign put out.", raisedBy: "", people: [], witnesses: [] });
  assert.ok(sent.ok && sent.id);
  reportId = sent.id!;
});
after(async () => { await fixture?.close(); });

test("only those who triage at the site see, search and link hazards", async () => {
  reporter();
  assert.equal(await links.hazardsOnReport(reportId), null, "the reporter is offered nothing");
  assert.deepEqual(await actions.searchReportHazards(reportId, "wet"), []);
  assert.equal((await actions.linkReportHazards(reportId, link(["hz-1"]))).ok, false);
  as("dan", [at(churchfield, ["incidents.reports.review"])]);
  assert.equal((await actions.linkReportHazards(reportId, link(["hz-1"]))).ok, false, "triage at another site");

  duty();
  const panel = await links.hazardsOnReport(reportId);
  assert.deepEqual([panel?.canLink, panel?.links.length, panel?.area], [true, 0, "Main pool"]);
  assert.deepEqual((await actions.searchReportHazards(reportId, "wet")).map((h) => h.id), ["hz-1"]);
  assert.deepEqual(asked.at(-1), { siteId: bishopstown, q: "wet", area: "Main pool" }, "the report's site and area are asked for");
});

test("a link keeps the hazard's words, and lands in the history and the activity log", async () => {
  duty();
  assert.equal((await actions.linkReportHazards(reportId, link([]))).ok, false, "choose at least one");
  assert.equal((await actions.linkReportHazards(reportId, link(["hz-9"]))).ok, false, "not on an assessment in use");
  assert.deepEqual(await actions.linkReportHazards(reportId, link(["hz-1"], { note: "No sign was out" })), { ok: true });
  assert.equal(announced.length, 0, "nothing is announced unless a review is asked for");
  const [saved] = await fixture.prisma.incidentHazardLink.findMany({ where: { reportId } });
  assert.deepEqual([saved.hazardId, saved.hazardRef, saved.hazard, saved.assessment, saved.href, saved.note, saved.reviewAsked, saved.addedByName, saved.orgId],
    ["hz-1", "RA-BT-0001-HZ-001", "Wet floor at the pool edge", "RA-BT-0001 Main pool", "/risk-assessments/a1", "No sign was out", false, "dan", ORG]);
  const again = await actions.linkReportHazards(reportId, link(["hz-1"]));
  assert.match(again.ok ? "" : again.error, /already linked/);
  assert.deepEqual((await actions.searchReportHazards(reportId, "")).map((h) => h.id), ["hz-2"], "what is linked is not offered again");
  const event = await fixture.prisma.incidentEvent.findFirstOrThrow({ where: { reportId, action: "hazard_link" } });
  assert.equal(event.note, "RA-BT-0001-HZ-001");
  assert.equal(await fixture.prisma.auditLog.count({ where: { entity: "IncidentReport", entityId: reportId, action: "hazard_link" } }), 1);
});

test("asking for a review is announced once the links are saved, with no names from the report", async () => {
  duty();
  const input = link(["hz-1", "hz-2"], { askReview: true, note: "Sign missing twice this month" });
  assert.deepEqual(await actions.linkReportHazards(reportId, input), { ok: true });
  assert.equal(announced.length, 1);
  const number = (await fixture.prisma.incidentReport.findUniqueOrThrow({ where: { id: reportId } })).number;
  assert.deepEqual(announced[0], { name: "incidents.hazards.flagged", payload: {
    orgId: ORG, siteId: bishopstown, incidentId: reportId, incident: `INC-${String(number).padStart(5, "0")}`, operationId: input.operationId,
    hazardIds: ["hz-2"], note: "Sign missing twice this month", flaggedById: "dan", flaggedByName: "dan",
  } }, "only the hazard newly linked");
  const panel = await links.hazardsOnReport(reportId);
  assert.deepEqual(panel?.links.map((l) => [l.hazardRef, l.reviewAsked]), [["RA-BT-0001-HZ-001", false], ["RA-BT-0001-HZ-002", true]]);
});

test("a link is removed, not deleted; a closed report takes no changes; no register, nothing offered", async () => {
  duty();
  const first = await fixture.prisma.incidentHazardLink.findFirstOrThrow({ where: { reportId, hazardId: "hz-1" } });
  reporter();
  assert.equal((await actions.unlinkReportHazard(first.id)).ok, false);
  duty();
  assert.deepEqual(await actions.unlinkReportHazard(first.id), { ok: true });
  assert.equal((await actions.unlinkReportHazard(first.id)).ok, false, "already removed");
  assert.ok((await fixture.prisma.incidentHazardLink.findUniqueOrThrow({ where: { id: first.id } })).removedAt, "kept, hidden");
  assert.equal((await links.hazardsOnReport(reportId))?.links.length, 1);

  registerOn = false;
  const off = await links.hazardsOnReport(reportId);
  assert.deepEqual([off?.canLink, off?.links.length], [false, 1], "links already made still read as they were");
  assert.deepEqual(await actions.searchReportHazards(reportId, ""), []);
  assert.equal((await actions.linkReportHazards(reportId, link(["hz-1"]))).ok, false);
  registerOn = true;

  const row = await fixture.prisma.incidentReport.findUniqueOrThrow({ where: { id: reportId } });
  assert.equal((await triage.triageReport(row.id, row.version, { severityActual: 1, severityPotential: 2, staffOffOver3Days: false, publicToDoctor: false, deathOrDangerous: false, parentInformed: "", outcome: "close", note: "Sign put back." })).ok, true);
  const closed = await actions.linkReportHazards(reportId, link(["hz-1"]));
  assert.match(closed.ok ? "" : closed.error, /closed report/);
  const panel = await links.hazardsOnReport(reportId);
  assert.deepEqual([panel?.canLink, panel?.canRemove, panel?.links.length], [false, false, 1]);
});
