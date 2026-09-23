import assert from "node:assert/strict";
import { test } from "node:test";
import { receptionPortalAccess, staffPortalPath } from "./reception-portal";
import { homePathFor } from "./staff/screens";
import { normaliseRoleHome } from "./staff/permissions";

const receptionScreens = ["students", "courses", "together", "assessments", "awaiting-enrolment"];
const receptionPermissions = ["students.manage", "enrolment.manage"];

test("reception landing is an explicit preference and does not change other staff", () => {
  assert.equal(normaliseRoleHome("reception-portal"), "reception-portal");
  assert.equal(staffPortalPath("reception-portal", receptionPermissions, receptionScreens), "/reception-portal");
  for (const home of ["calendar", "duty", "instructor", "reception", "unknown"]) {
    assert.equal(staffPortalPath(home, receptionPermissions, receptionScreens), "/modules");
  }
  assert.equal(staffPortalPath("reception-portal", [], []), "/modules");
});

test("receptionists only receive tasks and handoffs their current grants permit", () => {
  const access = receptionPortalAccess(receptionPermissions, receptionScreens);
  assert.equal(access.available, true);
  assert.equal(access.docs, false);
  assert.deepEqual(access.tasks.map(task => task.id), ["swimmers", "classes", "add", "assessments", "siblings"]);
  assert.deepEqual(access.followUp.map(task => task.id), ["enrolment", "moves"]);
  assert.equal(access.followUp.find(task => task.id === "moves")?.href, "/awaiting-enrolment?view=moves");
});

test("action links require both the destination screen and action permission", () => {
  assert.equal(receptionPortalAccess([], receptionScreens).tasks.some(task => task.id === "add" || task.id === "assessments"), false);
  assert.equal(receptionPortalAccess(["students.manage", "parents.manage", "enrolment.manage"], []).available, false);
  assert.equal(receptionPortalAccess(["parents.manage"], ["courses"]).followUp.some(task => task.id === "parents"), false);
  assert.equal(receptionPortalAccess(["parents.manage"], ["students"]).followUp.find(task => task.id === "parents")?.href, "/students/parents");
  assert.equal(receptionPortalAccess([], ["legend-agreements"]).followUp[0]?.id, "agreements");
});

test("Docs needs its screen and read permission, and does not grant Aquatics", () => {
  assert.equal(receptionPortalAccess([], ["docs"]).available, false);
  assert.equal(receptionPortalAccess(["docs.read"], []).docs, false);
  const access = receptionPortalAccess(["docs.read"], ["docs"]);
  assert.equal(access.available, true);
  assert.equal(access.aquatics, false);
  assert.equal(access.docs, true);
  assert.deepEqual(access.tasks, []);
});

test("administrators inherit reception access without a new grant; a single management permission does not", () => {
  const access = receptionPortalAccess(["staff.manage", "roles.manage"], []);
  assert.equal(access.docs, true);
  assert.equal(access.aquatics, true);
  assert.equal(access.tasks.length, 5);
  assert.equal(access.followUp.length, 4);
  for (const permission of ["staff.manage", "roles.manage"]) {
    assert.equal(receptionPortalAccess([permission], []).available, false);
  }
});

test("Instructor-only users gain no portal or desk access; opening Aquatics never loops back", () => {
  assert.equal(receptionPortalAccess(["attendance.mark"], ["instructor"]).available, false);
  assert.equal(staffPortalPath("reception-portal", ["attendance.mark"], ["instructor"]), "/modules");
  assert.equal(homePathFor("reception-portal", receptionPermissions, receptionScreens, "desk"), "/students");
  assert.equal(homePathFor("reception-portal", [...receptionPermissions, "attendance.mark"], [...receptionScreens, "instructor"]), "/students");
  assert.equal(homePathFor("reception-portal", receptionPermissions, [...receptionScreens, "calendar"], "desk"), "/schedule");
  assert.equal(homePathFor("instructor", ["attendance.mark"], ["instructor", "courses"], "desk"), "/courses");
});
