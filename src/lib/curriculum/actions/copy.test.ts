import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

test("legacy copy requests cannot recreate separate site curricula", async () => {
  let allowed = true;
  const actions = serverModule<typeof import("./copy")>("src/lib/curriculum/actions/copy.ts", {
    "@/lib/authz": { requirePermission: async (permission: string) => { assert.equal(permission, "curriculum.manage"); if (!allowed) throw Error("denied"); } },
  });
  const result = await actions.copyProgramme("programme", "other-site");
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /shared across all sites/);
  allowed = false;
  await assert.rejects(actions.copyProgramme("programme", "other-site"), /denied/);
});
