import assert from "node:assert/strict";
import { test } from "node:test";
import { ROSTER_DEPARTMENTS, rosterDepartment, siteForPlace } from "./departments";

/** The payroll system's department codes place a roster upload on its own. */
test("each code names its place and a name without it", () => {
  assert.deepEqual(rosterDepartment("520"), { label: "Pool", place: "CF" });
  assert.deepEqual(rosterDepartment("100"), { label: "Pool", place: "BT" });
  assert.deepEqual(rosterDepartment("401"), { label: "Head Office", place: "BT" });
  assert.deepEqual(rosterDepartment("710"), { label: "Reception", place: "Mahon" });
  assert.deepEqual(rosterDepartment("723"), { label: "Café", place: "SPC" });
  assert.deepEqual(rosterDepartment("764"), { label: "Supervisor", place: null });
  assert.equal(ROSTER_DEPARTMENTS.size, 56, "every code on the payroll list");
});

test("a code missing from the list is placed by its number", () => {
  assert.deepEqual(rosterDepartment("250"), { label: "Department 250", place: "BT" });
  assert.deepEqual(rosterDepartment("530"), { label: "Department 530", place: "CF" });
  assert.equal(rosterDepartment("999").place, null);
});

test("a place finds its Turnfin site by name; a place without one stays outside", () => {
  const sites = [{ id: "b", name: "LeisureWorld Bishopstown" }, { id: "c", name: "Churchfield" }, { id: "c2", name: "Churchfield Annex" }];
  assert.equal(siteForPlace("BT", sites)?.id, "b");
  assert.equal(siteForPlace("CF", sites)?.id, "c");
  assert.equal(siteForPlace("DO", sites), null);
  assert.equal(siteForPlace(null, sites), null);
});
