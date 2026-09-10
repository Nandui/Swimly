import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanScreens, homePathFor, visibleScreens } from "./screens";
import { expandPermissions, normaliseRoleHome } from "./permissions";

test("Reception is a selectable landing page only when the role offers it", () => {
  assert.equal(homePathFor("reception", [], ["reception"]), "/reception");
  assert.equal(homePathFor("reception", [], ["overview"]), "/");
  assert.equal(homePathFor("reception", [], []), "/account");
});

test("Reception screen access does not require or grant enrolment or deck permissions", () => {
  assert.deepEqual([...visibleScreens(["reception", "calendar"], expandPermissions([]))], ["reception", "calendar"]);
  assert.equal(visibleScreens(["students", "courses"], expandPermissions(["enrolment.manage"])).has("reception"), false);
});

test("Today can be read without attendance permission, but still needs screen access", () => {
  assert.equal(homePathFor("calendar", [], ["calendar"]), "/today");
  assert.equal(visibleScreens([], expandPermissions(["attendance.mark"])).has("calendar"), false);
});

test("existing Today roles retain deck access and their instructor landing page", () => {
  assert.deepEqual(cleanScreens(["today", "unknown", "today"]), ["calendar", "instructor"]);
  assert.deepEqual([...visibleScreens(["today"], expandPermissions(["attendance.mark"]))], ["calendar", "instructor"]);
  assert.equal(homePathFor("today", ["attendance.mark"], ["today"]), "/instructor");
  assert.equal(normaliseRoleHome("today"), "instructor");
});

test("the two explicit screen grants stay independent and Instructor requires attendance", () => {
  assert.deepEqual([...visibleScreens(["instructor"], expandPermissions([]))], []);
  assert.deepEqual([...visibleScreens(["calendar"], expandPermissions(["attendance.mark"]))], ["calendar"]);
  assert.deepEqual([...visibleScreens(["instructor"], expandPermissions(["attendance.mark"]))], ["instructor"]);
  assert.equal(homePathFor("instructor", ["attendance.mark"], ["instructor"]), "/instructor");
  assert.equal(homePathFor("instructor", [], ["calendar"]), "/today");
  assert.equal(normaliseRoleHome("calendar"), "calendar");
});
