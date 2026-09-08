import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { serverModule } from "@/test/server-module";
import { validOperationToken } from "./token";
import { operationContext } from "./context";

test("operator token fails closed without configuration and compares the complete secret", () => {
  const hash = createHash("sha256").update("synthetic-key").digest("hex");
  assert.equal(validOperationToken("Bearer synthetic-key", hash), true);
  for (const header of [null, "synthetic-key", "Bearer wrong", "Bearer synthetic-key ", `Bearer ${"x".repeat(300)}`]) assert.equal(validOperationToken(header, hash), false);
  assert.equal(validOperationToken("Bearer synthetic-key", undefined), false);
  assert.equal(validOperationToken("Bearer synthetic-key", "bad"), false);
});

test("operations enforce token, expiry, actor, explicit club, and use isolated action context", async () => {
  const keys = ["SWIMLY_OPERATIONS_TOKEN_SHA256", "SWIMLY_OPERATIONS_ACTOR", "SWIMLY_OPERATIONS_EXPIRES"];
  const old = keys.map(k => process.env[k]);
  process.env.SWIMLY_OPERATIONS_TOKEN_SHA256 = createHash("sha256").update("synthetic-key").digest("hex");
  process.env.SWIMLY_OPERATIONS_ACTOR = "Synthetic Operator";
  process.env.SWIMLY_OPERATIONS_EXPIRES = "2099-01-01";
  let reads = 0, active = true, ambiguous = false;
  const contexts: unknown[] = [];
  const action = async () => { contexts.push(operationContext.getStore()); return { ok: false, error: "Validation preserved" }; };
  class AuthorizationError extends Error {}
  const route = serverModule<typeof import("@/app/api/operations/route")>("src/app/api/operations/route.ts", {
    "@/lib/operations/token": { validOperationToken }, "@/lib/operations/context": { operationContext },
    "@/lib/authz": { AuthorizationError },
    "@/lib/staff/permissions": { expandPermissions: (p: string[]) => new Set(p) },
    "@/lib/prisma": { prisma: {
      user: { findMany: async () => { reads++; const actor = { id: "actor", name: "Synthetic Operator", staffRole: { id: "role", name: "Custom", permissions: ["students.manage", "staff.manage"], home: "reception", screens: [] } }; return active ? ambiguous ? [actor, actor] : [actor] : []; } },
      club: { findMany: async () => [{ id: "club-a", name: "A" }, { id: "club-b", name: "B" }] },
    } },
    "@/lib/students/actions/students": { createStudent: action, updateStudent: action },
    "@/lib/courses/actions/courses": { createCourse: action, updateCourse: action },
    "@/lib/enrolment/actions/enrolment": { enrolStudent: action },
  });
  const request = (body: unknown, token = "synthetic-key", extra = {}) => route.POST(new Request("https://example.test/api/operations", {
    method: "POST", headers: { authorization: `Bearer ${token}`, ...extra }, body: JSON.stringify(body),
  }));
  try {
    assert.equal((await request({ operation: "check" }, "wrong")).status, 401);
    assert.equal(reads, 0);
    assert.equal((await request({ operation: "check" }, "synthetic-key", { origin: "https://example.test" })).status, 403);
    process.env.SWIMLY_OPERATIONS_EXPIRES = "2000-01-01";
    assert.equal((await request({ operation: "check" })).status, 401);
    process.env.SWIMLY_OPERATIONS_EXPIRES = "2099-01-01";
    assert.equal((await request({ operation: "sql", input: "DROP TABLE" })).status, 400);
    assert.equal((await request({ operation: "check", query: "x".repeat(66000) })).status, 413);
    assert.equal((await request({ operation: "students.create" })).status, 400);
    assert.equal((await request({ operation: "students.create", clubId: "unknown" })).status, 400);
    active = false; assert.equal((await request({ operation: "check" })).status, 403);
    active = true; ambiguous = true; assert.equal((await request({ operation: "check" })).status, 403); ambiguous = false;
    const check = await (await request({ operation: "check" })).json();
    assert.deepEqual(check.permissions, ["students.manage"]);
    await Promise.all(["club-a", "club-b"].map(async clubId => {
      const result = await (await request({ operation: "students.create", clubId, input: {} })).json();
      assert.equal(result.error, "Validation preserved");
    }));
    assert.deepEqual(contexts.map(c => (c as { clubId: string }).clubId).sort(), ["club-a", "club-b"]);
    assert.equal(operationContext.getStore(), undefined);
  } finally { keys.forEach((k, i) => { if (old[i] === undefined) delete process.env[k]; else process.env[k] = old[i]; }); }
});
