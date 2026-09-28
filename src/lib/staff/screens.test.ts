import assert from "node:assert/strict";
import { test } from "node:test";
import { ADMINISTRATOR_SCREENS, ALL_SCREENS, SCREENS, visibleScreens } from "./screens";
import { ALL_PERMISSIONS, expandPermissions } from "./permissions";

/** One access language: a screen appears exactly when its permission is held. */

test("every screen asks for a permission that exists", () => {
  for (const screen of SCREENS) assert.ok((ALL_PERMISSIONS as readonly string[]).includes(screen.requires), `${screen.key} → ${screen.requires}`);
});

test("administrators see every screen except restricted ones; superadmins see all", () => {
  assert.deepEqual([...visibleScreens(expandPermissions(["staff.manage", "roles.manage"]))], ADMINISTRATOR_SCREENS);
  assert.equal(ADMINISTRATOR_SCREENS.includes("hr"), false);
  assert.deepEqual([...visibleScreens(expandPermissions([], { superadmin: true }))], ALL_SCREENS);
});

test("a single permission opens only its own screen", () => {
  assert.deepEqual([...visibleScreens(expandPermissions(["staff.manage"]))], ["staff"]);
  assert.deepEqual([...visibleScreens(expandPermissions(["docs.read"]))], ["docs"]);
  assert.deepEqual([...visibleScreens(expandPermissions([]))], []);
});

test("the desk and the pool deck never open each other", () => {
  const desk = visibleScreens(expandPermissions(["swimschool.desk", "students.manage", "enrolment.manage"]));
  assert.ok(desk.has("students") && desk.has("calendar") && !desk.has("instructor"));
  const deck = visibleScreens(expandPermissions(["attendance.mark", "attendance.cover", "progression.complete"]));
  assert.deepEqual([...deck], ["instructor"]);
});

test("roles not yet converted keep the desk through the permissions they hold", () => {
  assert.ok(visibleScreens(expandPermissions(["enrolment.manage"])).has("students"));
});
