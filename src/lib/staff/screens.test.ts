import assert from "node:assert/strict";
import { test } from "node:test";
import { ALL_SCREENS, cleanScreens, homePathFor, visibleScreens } from "./screens";
import { expandPermissions, normaliseRoleHome, ROLE_HOME_ORDER, ROLE_HOMES } from "./permissions";

test("retired Reception homes fall back to an accessible screen without granting new access", () => {
  assert.equal(homePathFor("reception", [], ["reception"]), "/account");
  assert.equal(homePathFor("reception", [], ["overview"]), "/");
  assert.equal(homePathFor("reception", [], ["reception", "students"]), "/students");
  assert.equal(homePathFor("reception", [], ["reception", "calendar"]), "/today");
  assert.equal(homePathFor("reception", [], []), "/account");
  assert.equal(normaliseRoleHome("reception"), "overview");
});

test("Reception is absent from screen and home choices, including old stored role keys", () => {
  assert.deepEqual([...visibleScreens(["reception", "calendar"], expandPermissions([]))], ["calendar"]);
  assert.deepEqual(cleanScreens(["reception", "unknown"]), []);
  assert.ok(!ALL_SCREENS.some(key => String(key) === "reception"));
  assert.ok(ROLE_HOME_ORDER.every(key => String(ROLE_HOMES[key].path) !== "/reception"));
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
