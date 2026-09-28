import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionUserFor, type Account } from "./session-user";

const account = (): Account => ({
  id: "ava", name: "Ava", email: "ava@example.invalid", isActive: true, orgId: "lw", isSuperadmin: false,
  staffRole: { id: "instructor", name: "Instructor", permissions: ["attendance.mark"], home: "instructor", screens: ["instructor"] },
});

test("a role not yet converted applies its stored keys everywhere; no role reads as signed out", () => {
  const user = sessionUserFor(account(), "bishopstown")!;
  assert.deepEqual(user.permissions, ["attendance.mark"]);
  assert.deepEqual(user.screens, ["instructor"]);
  assert.deepEqual(user.grants, []);
  assert.equal(sessionUserFor({ ...account(), staffRole: null }, null), null);
});

const levelled = (levels: Record<string, string>, siteIds: string[] = [], extras: string[] = []): Account => ({
  ...account(),
  siteIds,
  staffRole: { id: "reception", name: "Receptionist", permissions: [], home: "calendar", screens: [], levels, extras, homeName: "Front of House" },
});

test("a role with levels is built from its levels, not its stored keys", () => {
  const user = sessionUserFor(levelled({ "swim-school": "desk", refunds: "use", docs: "read" }), "bishopstown")!;
  for (const key of ["students.manage", "refunds.request", "docs.read"]) assert.ok(user.permissions.includes(key), key);
  assert.ok(user.screens.includes("refunds") && user.screens.includes("students"));
  assert.ok(user.primaryPermissions.includes("students.manage"), "no sites set: the desk applies everywhere");
  assert.equal(user.grants.length, 0);
});

test("Swim school, Training and Rota apply only at the sites a person works at", () => {
  const at = (site: string) => sessionUserFor(levelled({ "swim-school": "desk", refunds: "use" }, ["churchfield"]), site)!;
  assert.ok(at("churchfield").permissions.includes("enrolment.manage"));
  assert.ok(!at("bishopstown").permissions.includes("enrolment.manage"), "not at a site they do not work at");
  assert.ok(at("bishopstown").permissions.includes("refunds.request"), "Refunds applies everywhere");
  const grants = at("bishopstown").grants;
  assert.deepEqual(grants.map((g) => [g.scopeKind, g.scopeId]), [["site", "churchfield"]]);
  assert.ok(!at("bishopstown").primaryPermissions.includes("enrolment.manage"));
});

test("HR Their team reaches only the holder's reports, never the flat checks", () => {
  const user = sessionUserFor(levelled({ hr: "team" }), null)!;
  assert.ok(!user.permissions.includes("hr.records.read"));
  assert.deepEqual(user.grants.map((g) => g.scopeKind), ["reports"]);
  assert.ok(user.grants[0].permissions.includes("hr.reviews.write"));
});
