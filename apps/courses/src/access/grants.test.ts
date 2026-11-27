import assert from "node:assert/strict";
import { test } from "node:test";
import { grantsOf, may, siteFilter } from "./grants";

test("a stored grant gives itself and what it includes", () => {
  assert.deepEqual([...grantsOf(["lead"])].sort(), ["lead", "teach"]);
  assert.deepEqual([...grantsOf(["manage"])].sort(), ["desk", "manage"]);
  assert.deepEqual([...grantsOf(["desk"])], ["desk"]);
});

test("an unknown stored grant is ignored", () => {
  assert.deepEqual([...grantsOf(["desk", "superuser", ""])], ["desk"]);
});

test("nothing is given by default", () => {
  const nobody = { grants: grantsOf([]), siteIds: [] };
  assert.equal(may(nobody, "desk"), false);
  assert.equal(may(nobody, "accounts", "site-a"), false);
});

test("a grant reaches only the account's sites", () => {
  const desk = { grants: grantsOf(["desk"]), siteIds: ["site-a"] };
  assert.equal(may(desk, "desk"), true);
  assert.equal(may(desk, "desk", "site-a"), true);
  assert.equal(may(desk, "desk", "site-b"), false);
  assert.equal(may(desk, "manage", "site-a"), false);
});

test("no sites listed means every site", () => {
  const everywhere = { grants: grantsOf(["teach"]), siteIds: [] };
  assert.equal(may(everywhere, "teach", "site-b"), true);
  assert.equal(siteFilter(everywhere), undefined);
  assert.deepEqual(siteFilter({ grants: grantsOf([]), siteIds: ["site-a"] }), { in: ["site-a"] });
});
