import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";

/** The People core against a real (in-memory) Postgres: org chart rules,
 *  where people work, the superadmin tier and scoped qualification records. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: typeof import("./actions");
const ORG = "org_leisureworld";
const state = { id: "admin", permissions: ["staff.manage", "roles.manage"] as string[], superadmin: false, grants: [] as { roleName: string; permissions: string[]; scopeKind: string; scopeId: string }[] };

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: state.superadmin, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions, screens: ["staff"], primaryScreens: ["staff"], grants: state.grants } };
}
function doubles() {
  const authz = {
    AuthorizationError: class extends Error {},
    requireSession: async () => session(),
    can: (s: { user: { permissions: string[]; isSuperadmin?: boolean } }, p: PermissionKey) => expandPermissions(s.user.permissions, { superadmin: s.user.isSuperadmin }).has(p),
    requirePermission: async (p: PermissionKey) => {
      if (!expandPermissions(state.permissions, { superadmin: state.superadmin }).has(p)) throw new Error(`denied ${p}`);
      return session();
    },
  };
  return {
    "@/lib/prisma": { prisma: fixture.prisma },
    "@/lib/authz": authz,
    "@/lib/clubs/current": { currentClubId: async () => "club_bishopstown", currentClubIdIfAny: async () => null, getCurrentClub: async () => ({ club: { id: "club_bishopstown", name: "Bishopstown" }, clubs: [] }) },
    "next/cache": { revalidatePath() {} },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
}
const as = (id: string, permissions: string[], extra: Partial<typeof state> = {}) => Object.assign(state, { id, permissions, superadmin: false, grants: [] }, extra);

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.staffRole.createMany({ data: [
    { id: "r-admin", name: "Administrator", permissions: ["staff.manage", "roles.manage"], screens: [] },
    { id: "r-staff", name: "Staff", permissions: ["docs.read"], screens: ["docs"] },
    { id: "r-lead", name: "Qualifications lead", permissions: ["qualifications.manage"], screens: ["staff"] },
    { id: "r-hr", name: "HR", permissions: [], screens: ["docs"], restricted: true },
  ] });
  const club = await db.club.findFirstOrThrow({ where: { orgId: ORG } });
  await db.department.createMany({ data: [
    { id: "d-aquatics", orgId: ORG, name: "Aquatics", clubId: club.id },
    { id: "d-reception", orgId: ORG, name: "Reception" },
  ] });
  for (const [id, role] of [["admin", "r-admin"], ["maya", "r-staff"], ["liam", "r-staff"], ["ava", "r-staff"], ["noah", "r-staff"]] as const) {
    await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: role, orgId: ORG } });
  }
  await db.organisation.create({ data: { id: "org-other", name: "Other", slug: "other" } });
  await db.user.create({ data: { id: "zoe", name: "zoe", email: "zoe@example.invalid", staffRoleId: "r-staff", orgId: "org-other" } });
  actions = serverModule("src/lib/people/actions.ts", doubles());
});
after(async () => { await fixture?.close(); });

test("profiles: departments with a main one, a manager, and no loops", async () => {
  as("admin", ["staff.manage", "roles.manage"]);
  const profile = (managerId: string, departmentIds: string[]) => ({ jobTitle: "Swim teacher", startedOn: "2024-05-01", primaryClubId: "", managerId, departmentIds, primaryDepartmentId: departmentIds[0] ?? "" });
  assert.deepEqual(await actions.updateProfile("liam", profile("maya", ["d-aquatics"])), { ok: true });
  assert.deepEqual(await actions.updateProfile("ava", profile("liam", ["d-aquatics"])), { ok: true });
  const loop = await actions.updateProfile("maya", profile("ava", []));
  assert.equal(loop.ok, false, "maya → liam → ava → maya would be a loop");
  assert.equal((await actions.updateProfile("ava", profile("ava", []))).ok, false, "nobody manages themselves");
  assert.equal((await actions.updateProfile("ava", profile("zoe", []))).ok, false, "manager from another organisation");
  const saved = await fixture.prisma.userDepartment.findMany({ where: { userId: "ava" } });
  assert.deepEqual(saved.map((d) => [d.departmentId, d.isPrimary]), [["d-aquatics", true]]);
  assert.ok(await fixture.prisma.auditLog.findFirst({ where: { entityId: "ava", summary: { contains: "profile" } } }));
});

test("the superadmin tier: only superadmins grant it, and the last one stays", async () => {
  as("admin", ["staff.manage", "roles.manage"]);
  assert.equal((await actions.setSuperadmin("maya", true)).ok, false, "administrators cannot make superadmins");
  await fixture.prisma.user.update({ where: { id: "admin" }, data: { isSuperadmin: true } });
  as("admin", ["staff.manage", "roles.manage"], { superadmin: true });
  assert.deepEqual(await actions.setSuperadmin("maya", true), { ok: true });
  assert.deepEqual(await actions.setSuperadmin("maya", false), { ok: true });
  assert.equal((await actions.setSuperadmin("admin", false)).ok, false, "last superadmin");
  assert.equal((await actions.setSuperadmin("zoe", true)).ok, false, "another organisation");
});

test("qualifications: a site lead records for the people at their site only", async () => {
  await fixture.prisma.user.update({ where: { id: "ava" }, data: { primaryClubId: "club_churchfield" } });
  await fixture.prisma.user.update({ where: { id: "noah" }, data: { primaryClubId: "club_bishopstown" } });
  const lead = { roleName: "Qualifications lead", permissions: ["qualifications.manage"], scopeKind: "site", scopeId: "club_churchfield" };
  as("liam", ["docs.read"], { grants: [lead] });
  const nplq = await fixture.prisma.qualificationType.findFirstOrThrow({ where: { orgId: ORG, name: { startsWith: "National Pool" } } });
  const record = { typeId: nplq.id, issuedOn: "2026-01-10", expiresOn: "2028-01-10", reference: "NPLQ-123", note: "" };
  assert.deepEqual(await actions.recordQualification("ava", record), { ok: true });
  await assert.rejects(actions.recordQualification("noah", record), /permission/, "noah works at another site");
  assert.equal((await actions.recordQualification("ava", { ...record, expiresOn: "2025-01-01" })).ok, false, "expires before issue");
  const saved = await fixture.prisma.qualification.findFirstOrThrow({ where: { userId: "ava" } });
  assert.equal(saved.verifiedById, "liam");
  assert.deepEqual(await actions.revokeQualification(saved.id, "Certificate withdrawn by awarding body"), { ok: true });
  assert.ok((await fixture.prisma.qualification.findUniqueOrThrow({ where: { id: saved.id } })).revokedAt);
});

test("departments cannot be archived while people or roles still depend on them", async () => {
  as("admin", ["staff.manage", "roles.manage"]);
  assert.equal((await actions.setDepartmentArchived("d-aquatics", true)).ok, false);
  assert.deepEqual(await actions.saveDepartment(null, { name: "Maintenance", clubId: "" }), { ok: true });
  const maintenance = await fixture.prisma.department.findFirstOrThrow({ where: { name: "Maintenance" } });
  assert.deepEqual(await actions.setDepartmentArchived(maintenance.id, true), { ok: true });
});

test("works at: only the organisation's live sites, audited, and none means every site", async () => {
  as("admin", ["staff.manage", "roles.manage"]);
  const club = await fixture.prisma.club.findFirstOrThrow({ where: { orgId: ORG } });
  assert.equal((await actions.setWorksAt("maya", ["not-a-site"])).ok, false);
  assert.equal((await actions.setWorksAt("maya", [club.id])).ok, true);
  assert.deepEqual((await fixture.prisma.user.findUniqueOrThrow({ where: { id: "maya" } })).siteIds, [club.id]);
  const audit = await fixture.prisma.auditLog.findFirstOrThrow({ where: { entityId: "maya", summary: { contains: "now works at" } } });
  assert.match(audit.summary, new RegExp(`maya now works at ${club.name}`));
  assert.equal((await actions.setWorksAt("maya", [])).ok, true);
  assert.deepEqual((await fixture.prisma.user.findUniqueOrThrow({ where: { id: "maya" } })).siteIds, []);
  as("maya", ["docs.read"]);
  await assert.rejects(actions.setWorksAt("maya", [club.id]), /denied staff.manage/);
});
