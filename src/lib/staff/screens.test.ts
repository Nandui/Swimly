import assert from "node:assert/strict";
import { test } from "node:test";
import { ALL_SCREENS, cleanScreens, homePathFor, visibleScreens } from "./screens";
import { expandPermissions, normaliseRoleHome, ROLE_HOME_ORDER, ROLE_HOMES } from "./permissions";

test("administrators inherit every current screen regardless of old stored screen grants", () => {
  const permissions = expandPermissions(["staff.manage", "roles.manage"]);
  for (const stored of [[], ["overview"], ["reception", "today", "unknown"]]) {
    assert.deepEqual([...visibleScreens(stored, permissions)], ALL_SCREENS);
  }
  assert.equal(homePathFor("duty", [...permissions], []), "/duty");
  assert.equal(homePathFor("instructor", [...permissions], []), "/instructor");
  assert.equal(homePathFor("instructor", [...permissions], [], "desk"), "/schedule");
});

test("a single management permission does not inherit any screens", () => {
  for (const key of ["staff.manage", "roles.manage"]) {
    assert.deepEqual([...visibleScreens([], expandPermissions([key]))], []);
    assert.equal(visibleScreens(["staff", "roles"], expandPermissions([key])).has("duty"), false);
  }
});

test("Analytics is automatic for administrators and separately grantable for other roles", () => {
  assert.equal(visibleScreens([], expandPermissions(["staff.manage", "roles.manage"])).has("analytics"), true);
  assert.deepEqual([...visibleScreens(["analytics"], expandPermissions([]))], ["analytics"]);
  assert.equal(visibleScreens(["instructor"], expandPermissions(["attendance.markAny"])).has("analytics"), false);
  assert.equal(visibleScreens(["duty"], expandPermissions(["classes.cancel"])).has("analytics"), false);
});

test("duty and billing are explicitly granted screens with no implicit desk or instructor access", () => {
  assert.deepEqual([...visibleScreens(["duty"], expandPermissions(["classes.cancel"]))], ["duty"]);
  assert.deepEqual([...visibleScreens(["cancellations"], expandPermissions(["billing.notify"]))], ["cancellations"]);
  assert.equal(homePathFor("duty", ["classes.cancel"], ["duty"]), "/duty");
  assert.equal(visibleScreens(["instructor"], expandPermissions(["attendance.markAny"])).has("duty"), false);
  assert.equal(expandPermissions(["courses.manage"]).has("classes.cancel"), false);
});

test("retired Reception homes fall back to an accessible screen without granting new access", () => {
  assert.equal(homePathFor("reception", [], ["reception"]), "/account");
  assert.equal(homePathFor("reception", [], ["overview"]), "/account");
  assert.equal(homePathFor("reception", [], ["reception", "students"]), "/students");
  assert.equal(homePathFor("reception", [], ["reception", "calendar"]), "/schedule");
  assert.equal(homePathFor("reception", [], []), "/account");
  assert.equal(normaliseRoleHome("reception"), "calendar");
});

test("Reception is absent from screen and home choices, including old stored role keys", () => {
  assert.deepEqual([...visibleScreens(["reception", "calendar"], expandPermissions([]))], ["calendar"]);
  assert.deepEqual(cleanScreens(["reception", "unknown"]), []);
  assert.ok(!ALL_SCREENS.some(key => String(key) === "reception"));
  assert.ok(ROLE_HOME_ORDER.every(key => String(ROLE_HOMES[key].path) !== "/reception"));
});

test("Today can be read without attendance permission, but still needs screen access", () => {
  assert.equal(homePathFor("calendar", [], ["calendar"]), "/schedule");
  assert.equal(visibleScreens([], expandPermissions(["attendance.mark"])).has("calendar"), false);
});

test("existing Today roles retain deck access and their instructor landing page", () => {
  assert.deepEqual(cleanScreens(["today", "unknown", "today"]), ["instructor"]);
  assert.deepEqual([...visibleScreens(["today"], expandPermissions(["attendance.mark"]))], ["instructor"]);
  assert.equal(homePathFor("today", ["attendance.mark"], ["today"]), "/instructor");
  assert.equal(normaliseRoleHome("today"), "instructor");
});

test("legacy desk roles keep Today while deck-only roles gain no desk screens", () => {
  assert.deepEqual(cleanScreens(["overview", "today", "courses"]), ["calendar", "instructor", "courses"]);
  assert.deepEqual(cleanScreens(["overview", "today"]), ["calendar", "instructor"]);
  assert.equal(visibleScreens(["today", "courses"], expandPermissions(["attendance.markAny"])).has("calendar"), true);
  assert.equal(visibleScreens(["today"], expandPermissions(["attendance.markAny"])).has("calendar"), false);
});

test("Overview is retired from screen and landing choices without granting new access", () => {
  assert.deepEqual(cleanScreens(["overview"]), []);
  assert.equal(ALL_SCREENS.some(key => String(key) === "overview"), false);
  assert.equal(ROLE_HOME_ORDER.some(key => String(key) === "overview"), false);
  assert.equal(Object.values(ROLE_HOMES).some(home => String(home.path) === "/"), false);
  for (const oldHome of ["overview", "unknown", "constructor", "toString", null]) {
    assert.equal(normaliseRoleHome(oldHome), "calendar");
  }
  assert.equal(homePathFor("overview", [], ["overview", "calendar", "duty"]), "/schedule");
  assert.equal(homePathFor("overview", [], ["overview", "duty"]), "/duty");
  assert.equal(homePathFor("overview", [], ["overview", "students"]), "/students");
  assert.equal(homePathFor("overview", [], ["overview"]), "/account");
});

test("the two explicit screen grants stay independent and Instructor requires attendance", () => {
  assert.deepEqual([...visibleScreens(["instructor"], expandPermissions([]))], []);
  assert.deepEqual([...visibleScreens(["calendar"], expandPermissions(["attendance.mark"]))], ["calendar"]);
  assert.deepEqual([...visibleScreens(["instructor"], expandPermissions(["attendance.mark"]))], ["instructor"]);
  assert.equal(homePathFor("instructor", ["attendance.mark"], ["instructor"]), "/instructor");
  assert.equal(homePathFor("instructor", [], ["calendar"]), "/schedule");
  assert.equal(normaliseRoleHome("calendar"), "calendar");
});
