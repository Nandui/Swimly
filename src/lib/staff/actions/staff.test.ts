import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

test("a person added on the Users page joins the organisation of whoever adds them", async () => {
  const created: Record<string, unknown>[] = [];
  const tx = {
    staffRole: { findUnique: async () => ({ id: "role", name: "Synthetic desk", permissions: ["enrolment.manage"], restricted: false }) },
    user: { create: async ({ data }: { data: Record<string, unknown> }) => { created.push(data); return { id: "new", name: data.name, email: data.email }; } },
  };
  const actions = serverModule<typeof import("./staff")>("src/lib/staff/actions/staff.ts", {
    "@/lib/prisma": { prisma: tx },
    "@/lib/authz": { requirePermission: async () => ({ user: { id: "actor", name: "Synthetic Manager", orgId: "org_synthetic", isSuperadmin: false } }) },
    "@/lib/staff/keyholders": { withKeyholderLock: (run: (db: typeof tx) => Promise<unknown>) => run(tx), guardKeyholders: async () => null, guardSuperadmins: async () => null },
    "@/lib/audit": { logAudit: async () => {} },
    "next/cache": { revalidatePath: () => {} },
  });
  const result = await actions.createPerson({ name: "Synthetic Starter", email: "starter@example.test", staffRoleId: "role", password: "Synthetic-pass-2026!" });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(created[0].orgId, "org_synthetic");
});
