import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

test("authenticated access awaits due unenrolments before returning the session", async () => {
  const calls: string[] = [];
  const guards = serverModule<typeof import("./authz")>("src/lib/authz.ts", {
    "@/auth": { auth: async () => { calls.push("auth"); return { user: { id: "staff" } }; } },
    "@/lib/enrolment/scheduled": { processScheduledUnenrolments: async () => { await Promise.resolve(); calls.push("due"); } },
  });
  await guards.requireSession(); calls.push("read");
  assert.deepEqual(calls, ["auth", "due", "read"]);
});

test("unauthenticated requests do not process scheduled unenrolments", async () => {
  let processed = false;
  const guards = serverModule<typeof import("./authz")>("src/lib/authz.ts", {
    "@/auth": { auth: async () => null },
    "@/lib/enrolment/scheduled": { processScheduledUnenrolments: async () => { processed = true; } },
  });
  await assert.rejects(guards.requireSession(), /Not signed in/);
  assert.equal(processed, false);
});
