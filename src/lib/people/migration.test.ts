import { test } from "node:test";
import assert from "node:assert/strict";
import { isolatedPrisma } from "@/test/pglite-prisma";

test("people-core migration backfills LeisureWorld and enforces scope rules", async () => {
  const fixture = await isolatedPrisma();
  const { prisma } = fixture;
  try {
  const org = await prisma.organisation.findUnique({ where: { slug: "leisureworld" } });
  assert.ok(org, "LeisureWorld organisation seeded");
  const types = await prisma.qualificationType.findMany({ where: { orgId: org.id } });
  assert.ok(types.some((t) => t.name.startsWith("National Pool Lifeguard")));
  const role = await prisma.staffRole.create({ data: { name: "Probe role", permissions: [], screens: ["staff"] } });
  const user = await prisma.user.create({
    data: { name: "Probe", email: "probe@example.invalid", staffRoleId: role.id, orgId: org.id },
  });
  // A site or department scope needs its id; unknown scope kinds are refused.
  await assert.rejects(prisma.roleAssignment.create({ data: { orgId: org.id, userId: user.id, roleId: role.id, scopeKind: "site" } }));
  await assert.rejects(prisma.roleAssignment.create({ data: { orgId: org.id, userId: user.id, roleId: role.id, scopeKind: "everywhere" } }));
  await prisma.roleAssignment.create({ data: { orgId: org.id, userId: user.id, roleId: role.id, scopeKind: "reports" } });
  // Nobody manages themselves.
  await assert.rejects(prisma.user.update({ where: { id: user.id }, data: { managerId: user.id } }));
  } finally { await fixture.close(); }
});
