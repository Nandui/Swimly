import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";

/** Work on work PCs: who may sign in to Work away from a registered device. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let rule: typeof import("./work-device");
const ORG = "org_leisureworld";

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.staffRole.createMany({ data: [
    { id: "r-staff", name: "Front desk", permissions: ["students.manage"], screens: [] },
    { id: "r-admin", name: "Administrator", permissions: ["staff.manage", "roles.manage"], screens: [] },
    { id: "r-duty", name: "Duty manager", permissions: ["work.anywhere"], screens: [] },
  ] });
  for (const [id, role, superadmin] of [["noah", "r-staff", false], ["alex", "r-admin", false], ["maya", "r-staff", false], ["sam", "r-staff", true]] as const) {
    await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: role, orgId: ORG, isSuperadmin: superadmin } });
  }
  // Maya works anywhere through an additional role, whatever its scope.
  await db.roleAssignment.create({ data: { orgId: ORG, userId: "maya", roleId: "r-duty", scopeKind: "department", scopeId: "d-any" } });
  rule = serverModule("src/lib/devices/work-device.ts", { "@/lib/prisma": { prisma: db } });
});
after(async () => fixture?.close());

test("the rule is off until WORK_DEVICE_REQUIRED=true", () => {
  assert.equal(rule.workDeviceRequired({}), false);
  assert.equal(rule.workDeviceRequired({ WORK_DEVICE_REQUIRED: "false" }), false);
  assert.equal(rule.workDeviceRequired({ WORK_DEVICE_REQUIRED: "true" }), true);
});

test("front-line staff need a work PC; work.anywhere, administrators and superadmins do not", async () => {
  assert.equal(await rule.mayWorkAnywhere("noah"), false);
  assert.equal(await rule.mayWorkAnywhere("maya"), true, "through an additional role");
  assert.equal(await rule.mayWorkAnywhere("alex"), true, "administrators inherit it");
  assert.equal(await rule.mayWorkAnywhere("sam"), true, "superadmin");
  assert.equal(await rule.mayWorkAnywhere("missing"), false);
});
