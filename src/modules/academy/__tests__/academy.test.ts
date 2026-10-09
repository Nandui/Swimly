import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { today } from "@/lib/format";

/** The Academy end to end on an isolated database: the course list, a course at a site, its
 *  sessions on the Rota's seam, candidates (staff and public) within the places, checks, a
 *  register, and a pass that puts the qualification on a staff member's record. Invented people. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: typeof import("../features/courses/server/actions") & typeof import("../features/course-types/server/actions");
let data: typeof import("../features/courses/server/data");
let contributions: typeof import("@/modules/contributions");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "tara", permissions: [] as string[], grants: [] as GrantRow[] };
let bishopstown = "", churchfield = "";
class Denied extends Error {}
class NotFound extends Error {}

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: ["academy"], primaryScreens: ["academy"], grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
const as = (id: string, permissions: string[], grants: GrantRow[] = []) => Object.assign(state, { id, permissions, grants });
const at = (siteId: string, permissions: string[]): GrantRow => ({ roleName: "Site", permissions, screens: ["academy"], scopeKind: "site", scopeId: siteId });
const plusDays = (n: number) => { const d = new Date(`${today()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const clubs = await db.club.findMany({ where: { orgId: ORG }, orderBy: { name: "asc" } });
  bishopstown = clubs.find((c) => c.name.includes("Bishopstown"))!.id;
  churchfield = clubs.find((c) => c.name.includes("Churchfield"))!.id;
  await db.siteArea.create({ data: { orgId: ORG, siteId: bishopstown, name: "Main pool" } });
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["tara", "owen", "kim"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG, siteIds: [bishopstown] } });
  await db.qualificationType.create({ data: { id: "qt-guard", orgId: ORG, name: "Synthetic pool lifeguard", validityMonths: 24 } });
  const d = {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": {
      AuthorizationError: class AuthorizationError extends Error {},
      requireSession: async () => session(),
      requirePermission: async (p: PermissionKey) => { if (!expandPermissions(state.permissions).has(p)) throw new Denied(p); return session(); },
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: () => true,
    },
    "@/lib/clubs/current": { currentClubId: async () => bishopstown, currentClubIdIfAny: async () => bishopstown },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound: () => { throw new NotFound("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  contributions = serverModule<typeof import("@/modules/contributions")>("src/modules/contributions.ts", d);
  serverModule("src/modules/academy/module.ts", { ...d, "@/modules/contributions": contributions });
  actions = { ...serverModule<object>("src/modules/academy/features/course-types/server/actions.ts", d), ...serverModule<object>("src/modules/academy/features/courses/server/actions.ts", d) } as typeof actions;
  data = serverModule("src/modules/academy/features/courses/server/data.ts", d);
});
after(async () => { await fixture?.close(); });

let courseId = "";

test("the course list and putting a course on need Manage, at the course's site", async () => {
  as("tara", ["academy.run"]);
  await assert.rejects(actions.saveCourseType(null, { name: "Synthetic NPLQ", kind: "lifeguard" }), Denied, "Tutor does not keep the list");
  as("tara", ["academy.manage"]);
  assert.equal((await actions.saveCourseType(null, { name: "Synthetic NPLQ", kind: "lifeguard", minAge: "16", minHours: 6, checks: ["age", "swim"], qualificationTypeId: "qt-guard" })).ok, true);
  assert.equal((await actions.saveCourseType(null, { name: "Something", kind: "lifeguard", checks: ["age"] })).ok, false, "the age check needs an age");
  const type = await fixture.prisma.academyCourseType.findFirstOrThrow({ where: { name: "Synthetic NPLQ" } });
  as("tara", [], [at(churchfield, ["academy.manage"])]);
  assert.equal((await actions.saveCourse(null, { siteId: bishopstown, typeId: type.id, capacity: 2, price: "350", tutorId: "tara" })).ok, false, "not their site");
  as("tara", [], [at(bishopstown, ["academy.manage"])]);
  const made = await actions.saveCourse(null, { siteId: bishopstown, typeId: type.id, capacity: 2, price: "350", tutorId: "tara", assessorId: "owen" });
  assert.equal(made.ok, true);
  courseId = made.id!;
  assert.equal((await actions.saveSession(courseId, null, { date: today(), start: "09:00", end: "12:00", place: "Main pool" })).ok, true);
  assert.equal((await actions.saveSession(courseId, null, { date: plusDays(1), start: "09:00", end: "12:00", place: "Nowhere" })).ok, false, "one of the site's areas");
  assert.equal((await actions.saveSession(courseId, null, { date: plusDays(1), start: "09:00", end: "12:00", place: "Main pool" })).ok, true);
  assert.equal((await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "AcademyCourse" } })).module, "Academy");
});

test("sessions reach the Rota through the commitments seam, for the tutor and the assessor", async () => {
  const seen = await contributions.commitmentsFor({ siteIds: [bishopstown], from: today(), to: today() });
  assert.deepEqual(seen.map((c) => [c.source, c.userId, c.place]).sort(), [["academy.sessions", "owen", "Main pool"], ["academy.sessions", "tara", "Main pool"]]);
  assert.equal(seen[0].title, "Synthetic NPLQ course");
});

test("candidates: staff or public, within the places; checks, register and readiness", async () => {
  as("kim", [], [at(bishopstown, ["academy.read"])]);
  assert.equal((await actions.saveCandidate(courseId, null, { name: "Pat Example" })).ok, false, "View cannot add");
  as("tara", [], [at(bishopstown, ["academy.run"])]);
  assert.equal((await actions.saveCandidate(courseId, null, { userId: "kim", payment: "waived" })).ok, true);
  assert.equal((await actions.saveCandidate(courseId, null, { name: "Pat Example", email: "pat@example.invalid", dateOfBirth: "2009-01-01", payment: "deposit", paid: "100" })).ok, true);
  assert.equal((await actions.saveCandidate(courseId, null, { name: "Third Example" })).ok, false, "two places");
  const [kim, pat] = await Promise.all(["kim", null].map((u) => fixture.prisma.academyCandidate.findFirstOrThrow({ where: { courseId, userId: u } })));
  assert.equal((await actions.recordChecks(kim.id, { dateOfBirth: "2000-05-05", swimTestOn: today() })).ok, true);
  const session = await fixture.prisma.academySession.findFirstOrThrow({ where: { courseId, date: new Date(`${today()}T00:00:00Z`) } });
  assert.equal((await actions.takeRegister(session.id, [{ candidateId: kim.id, minutes: 180 }, { candidateId: pat.id, minutes: 0 }])).ok, true);
  assert.equal((await actions.takeRegister(session.id, [{ candidateId: kim.id, minutes: 999 }])).ok, false, "longer than the session");
  const view = await data.academyCourse(courseId);
  const k = view.candidates.find((c) => c.id === kim.id)!;
  assert.equal(k.attended, 180);
  assert.equal(k.readiness.hoursOk, false, "3 of 6 hours");
  assert.equal(view.candidates.find((c) => c.id === pat.id)!.readiness.checks.find((c) => c.key === "swim")!.done, false);
});

test("a staff member who passes gets the qualification; changing the result withdraws it", async () => {
  as("tara", [], [at(bishopstown, ["academy.run"])]);
  const kim = await fixture.prisma.academyCandidate.findFirstOrThrow({ where: { courseId, userId: "kim" } });
  assert.equal((await actions.recordResult(kim.id, { status: "passed", resultOn: today(), certificateNumber: "SYN-001" })).ok, false, "a pass needs the certificate's expiry date");
  assert.equal((await actions.recordResult(kim.id, { status: "passed", resultOn: today(), certificateExpires: plusDays(730) })).ok, true, "its number is optional");
  const q = await fixture.prisma.qualification.findFirstOrThrow({ where: { userId: "kim", typeId: "qt-guard" } });
  assert.equal(q.reference, "");
  assert.equal(q.expiresOn?.toISOString().slice(0, 10), plusDays(730));
  assert.equal((await actions.recordResult(kim.id, { status: "referred", resultOn: today() })).ok, true);
  assert.ok((await fixture.prisma.qualification.findUniqueOrThrow({ where: { id: q.id } })).revokedAt, "withdrawn again");
  as("tara", [], [at(bishopstown, ["academy.manage"])]);
  assert.equal((await actions.setCourseStatus(courseId, "completed")).ok, false, "Pat has no result yet");
  assert.equal((await actions.setCourseStatus(courseId, "cancelled")).ok, true);
  assert.equal((await contributions.commitmentsFor({ siteIds: [bishopstown], from: today(), to: today() })).length, 0, "a cancelled course leaves the Rota");
});
