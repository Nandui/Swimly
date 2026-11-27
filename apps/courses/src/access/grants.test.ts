import assert from "node:assert/strict";
import { test } from "node:test";
import { GRANTS, grantsFor, may, siteFilter, type RoleFacts } from "./grants";

const role = (levels: unknown, extras: string[] = [], isSuperadmin = false): RoleFacts => ({ levels, extras, isSuperadmin });
const held = (facts: RoleFacts) => [...grantsFor(facts)].sort();

test("a receptionist's role gives the desk", () => {
  assert.deepEqual(held(role({ "swim-school": "desk", rota: "view", tasks: "do" })), ["desk"]);
});

test("an instructor's role gives their own classes", () => {
  assert.deepEqual(held(role({ "pool-deck": "teach" })), ["teach"]);
  assert.deepEqual(held(role({ "pool-deck": "lead" })), ["lead", "teach"]);
});

test("a higher level includes the one before it", () => {
  assert.deepEqual(held(role({ "swim-school": "manage" })), ["desk", "manage"]);
  assert.deepEqual(held(role({ academy: "manage" })), ["academy", "tutor"]);
});

test("the cancel tick gives cancelling, and nothing else does", () => {
  assert.deepEqual(held(role({ "swim-school": "desk" }, ["swim-school.cancel-classes", "docs.approve"])), ["cancel", "desk"]);
});

test("an administrator and a superadmin hold everything", () => {
  const all = Object.keys(GRANTS).sort();
  assert.deepEqual(held(role({ admin: "manage" })), all);
  assert.deepEqual(held(role(null, [], true)), all);
});

test("a role saved before short courses joined Classes still counts", () => {
  assert.deepEqual(held(role({ "short-courses": "instructor" })), ["teach"]);
});

test("no role, other apps and unknown values give nothing", () => {
  assert.deepEqual(held(role(null)), []);
  assert.deepEqual(held(role({ rota: "manage", hr: "sites", admin: "setup" })), []);
  assert.deepEqual(held(role({ "swim-school": "owner", "pool-deck": 3, toString: "desk" })), []);
  assert.deepEqual(held(role(["swim-school"])), []);
});

test("a grant reaches only the person's sites", () => {
  const desk = { grants: grantsFor(role({ "swim-school": "desk" })), siteIds: ["site-a"] };
  assert.equal(may(desk, "desk"), true);
  assert.equal(may(desk, "desk", "site-a"), true);
  assert.equal(may(desk, "desk", "site-b"), false);
  assert.equal(may(desk, "manage", "site-a"), false);
});

test("no sites listed means every site", () => {
  const everywhere = { grants: grantsFor(role({ "pool-deck": "teach" })), siteIds: [] };
  assert.equal(may(everywhere, "teach", "site-b"), true);
  assert.equal(siteFilter(everywhere), undefined);
  assert.deepEqual(siteFilter({ grants: new Set(), siteIds: ["site-a"] }), { in: ["site-a"] });
});
