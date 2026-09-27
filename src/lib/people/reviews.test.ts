import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";

/** Work-side review of what staff send from Turnfin Me: details changes need
 *  staff.manage, certificates need qualifications.manage for that person;
 *  nobody reviews their own; the record changes only when applied. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let details: typeof import("./details-actions");
let certificates: typeof import("@/lib/training/certificate-actions");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "alex", permissions: ["staff.manage", "roles.manage"] as string[], grants: [] as GrantRow[] };
const QUALS: GrantRow = { roleName: "Qualifications lead", permissions: ["qualifications.manage"], screens: [], scopeKind: "department", scopeId: "d-aquatics" };

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions, screens: [], primaryScreens: [], grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  await db.department.create({ data: { id: "d-aquatics", orgId: ORG, name: "Aquatics" } });
  for (const id of ["alex", "liam", "ava", "noah"]) {
    await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG, phone: "000" } });
  }
  for (const id of ["liam", "ava"]) await db.userDepartment.create({ data: { userId: id, departmentId: "d-aquatics" } });
  await db.qualificationType.create({ data: { id: "qt-life", orgId: ORG, name: "Synthetic lifeguard", validityMonths: 24 } });
  const doubles = {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": {
      AuthorizationError: class AuthorizationError extends Error {},
      requireSession: async () => session(),
      requirePermission: async (p: PermissionKey) => { if (!expandPermissions(state.permissions).has(p)) throw new Error(`denied ${p}`); return session(); },
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
    },
    "@/lib/clubs/current": { currentClubIdIfAny: async () => null },
    "next/cache": { revalidatePath() {} },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  details = serverModule("src/lib/people/details-actions.ts", doubles);
  certificates = serverModule("src/lib/training/certificate-actions.ts", doubles);
});
after(async () => fixture?.close());

test("a details change applies exactly what was asked, once, and never by the person themselves", async () => {
  const db = fixture.prisma;
  const own = await db.staffDetailChangeRequest.create({ data: { orgId: ORG, userId: "alex", proposed: { phone: "999" } } });
  const ava = await db.staffDetailChangeRequest.create({ data: { orgId: ORG, userId: "ava", proposed: { phone: "111 222", emergencyName: "Synthetic Neighbour" } } });
  Object.assign(state, { id: "alex", permissions: ["staff.manage", "roles.manage"], grants: [] });
  assert.equal((await details.applyDetailChange(own.id, "")).ok, false, "not your own");
  assert.equal((await details.declineDetailChange(ava.id, "")).ok, false, "a decline needs a reason");
  assert.equal((await details.applyDetailChange(ava.id, "Updated")).ok, true);
  const person = await db.user.findUniqueOrThrow({ where: { id: "ava" } });
  assert.equal(person.phone, "111 222");
  assert.equal(person.emergencyName, "Synthetic Neighbour");
  assert.equal((await details.applyDetailChange(ava.id, "")).ok, false, "decided once");
  Object.assign(state, { id: "liam", permissions: [], grants: [] });
  await assert.rejects(details.declineDetailChange(own.id, "No"), /denied/);
});

test("certificates: recorded only by a qualifications role that covers the person, with the type's validity", async () => {
  const db = fixture.prisma;
  const upload = (userId: string) => db.qualificationEvidence.create({ data: { orgId: ORG, userId, typeId: "qt-life", typeName: "Synthetic lifeguard", fileName: "c.png", mime: "image/png", size: 4, bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]) } });
  const ava = await upload("ava"), noah = await upload("noah"), liam = await upload("liam");
  Object.assign(state, { id: "liam", permissions: [], grants: [QUALS] });
  assert.equal((await certificates.verifyCertificate(noah.id, { typeId: "qt-life", issuedOn: "2026-01-01", expiresOn: "", reference: "" })).ok, false, "noah is outside Aquatics");
  assert.equal((await certificates.verifyCertificate(liam.id, { typeId: "qt-life", issuedOn: "2026-01-01", expiresOn: "", reference: "" })).ok, false, "not your own");
  assert.equal((await certificates.verifyCertificate(ava.id, { typeId: "qt-life", issuedOn: "2026-01-01", expiresOn: "", reference: "NPLQ-1" })).ok, true);
  const q = await db.qualification.findFirstOrThrow({ where: { userId: "ava" } });
  assert.equal(q.verifiedById, "liam");
  assert.equal(q.expiresOn?.toISOString().slice(0, 10), "2028-01-01");
  assert.equal((await db.qualificationEvidence.findUniqueOrThrow({ where: { id: ava.id } })).qualificationId, q.id);
  assert.equal((await certificates.verifyCertificate(ava.id, { typeId: "qt-life", issuedOn: "2026-01-01", expiresOn: "", reference: "" })).ok, false, "decided once");
  Object.assign(state, { id: "alex", permissions: ["staff.manage", "roles.manage"], grants: [] });
  assert.equal((await certificates.declineCertificate(noah.id, "Unreadable photo")).ok, true, "administrators inherit qualifications.manage");
  assert.equal(await db.qualification.count({ where: { userId: "noah" } }), 0);
});
