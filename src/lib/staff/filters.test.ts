import assert from "node:assert/strict";
import { test } from "node:test";
import { countBy, filterPeople, matchesSearch, readStaffFilters, staffBackHref, staffListHref } from "./filters";

const people = [
  { name: "Seán Ó Briain", email: "sean@example.ie", isActive: true, staffRoleId: "desk", siteIds: ["cork"], departmentIds: ["pool"] },
  { name: "Aoife Murphy", email: "aoife@example.ie", isActive: true, staffRoleId: "manager", siteIds: [], departmentIds: ["gym"] },
  { name: "Ciara Walsh", email: "ciara@example.ie", isActive: false, staffRoleId: "desk", siteIds: ["douglas"], departmentIds: ["pool"] },
];
const names = (list: typeof people) => list.map((p) => p.name.split(" ")[0]);

test("finds people by name or email, ignoring accents and case", () => {
  assert.equal(matchesSearch(people[0], "sean briain"), true);
  assert.equal(matchesSearch(people[1], "AOIFE@"), true);
  assert.equal(matchesSearch(people[1], "aoife walsh"), false);
});

test("combines search and filters", () => {
  assert.deepEqual(names(filterPeople(people, readStaffFilters({ role: "desk" }))), ["Seán", "Ciara"]);
  assert.deepEqual(names(filterPeople(people, readStaffFilters({ role: "desk", show: "active" }))), ["Seán"]);
  assert.deepEqual(names(filterPeople(people, readStaffFilters({ department: "pool", q: "ciara" }))), ["Ciara"]);
});

test("counts someone with no sites at every site", () => {
  assert.deepEqual(names(filterPeople(people, readStaffFilters({ site: "douglas" }))), ["Aoife", "Ciara"]);
});

test("counts each choice with the other filters kept", () => {
  const counts = countBy(people, readStaffFilters({ show: "active", role: "manager" }), "role", (p) => [p.staffRoleId]);
  assert.equal(counts.get("desk"), 1);
  assert.equal(counts.get("manager"), 1);
});

test("drops unknown values and keeps the way back on the Staff list", () => {
  assert.equal(readStaffFilters({ show: "nonsense" }).show, "all");
  assert.equal(staffListHref(readStaffFilters({ q: " sean ", show: "inactive" })), "/staff?q=sean&show=inactive");
  assert.equal(staffBackHref("q=sean&next=https://evil.example"), "/staff?q=sean");
  assert.equal(staffBackHref(undefined), "/staff");
});
