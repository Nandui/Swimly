import assert from "node:assert/strict";
import { test } from "node:test";
import { NAV_ITEMS, isNavItemActive, swimmerLookupHref, visibleNavGroups } from "./nav";
import { visibleScreens } from "./staff/screens";
import { expandPermissions } from "./staff/permissions";

test("administrators see every desk destination, including duty and billing, without a link into Instructor", () => {
  const screens = visibleScreens(["overview"], expandPermissions(["staff.manage", "roles.manage"]));
  const links = visibleNavGroups(screens).flatMap(group => group.items.map(item => item.href));
  assert.deepEqual(new Set(links), new Set(NAV_ITEMS.map(item => item.href)));
  assert.ok(links.includes("/duty"));
  assert.ok(links.includes("/cancellations"));
  assert.equal(links.includes("/instructor"), false);
  assert.equal(links.includes("/"), false);
  assert.equal(NAV_ITEMS.some(item => item.label === "Overview"), false);
});

test("grouping preserves screen and permission restrictions without empty headings", () => {
  const screens = visibleScreens(["calendar", "instructor", "roles", "activity"], expandPermissions(["attendance.mark"]));
  const groups = visibleNavGroups(screens);
  assert.deepEqual(groups.map(group => group.label), ["Daily work"]);
  assert.deepEqual(groups.flatMap(group => group.items.map(item => item.href)), ["/schedule"]);
  assert.deepEqual(visibleNavGroups(new Set(["instructor"])), []);
  assert.deepEqual(visibleNavGroups(new Set()), []);
});

test("Setup retains only allowed destinations", () => {
  const groups = visibleNavGroups(new Set(["students", "staff", "clubs"]));
  const setup = groups.find(group => group.id === "setup");
  assert.deepEqual(setup?.items.map(item => item.href), ["/staff", "/clubs"]);
  assert.equal(setup?.collapsible, true);
});

test("nested pages select their destination without prefix collisions", () => {
  assert.equal(isNavItemActive("/students/demo", "/students"), true);
  assert.equal(isNavItemActive("/programmes/demo/levels/new", "/programmes"), true);
  assert.equal(isNavItemActive("/students-archive", "/students"), false);
  assert.equal(isNavItemActive("/schedule", "/"), false);
  assert.equal(isNavItemActive("/", "/"), true);
});

test("swimmer lookup requires the Swimmers screen and never links to retired Reception", () => {
  const retired = visibleScreens(["reception"], expandPermissions([]));
  assert.equal(swimmerLookupHref(retired, "demo"), null);
  assert.deepEqual(visibleNavGroups(retired), []);
  const screens = visibleScreens(["students", "reception", "calendar"], expandPermissions([]));
  assert.deepEqual(visibleNavGroups(screens).flatMap(group => group.items.map(item => item.href)), ["/schedule", "/students"]);
  assert.equal(swimmerLookupHref(screens, "demo"), "/students/demo");
  assert.equal(swimmerLookupHref(new Set(["instructor"]), "demo"), null);
  assert.equal(swimmerLookupHref(new Set(), "demo"), null);
  assert.equal(swimmerLookupHref(new Set(["students"]), "a&b"), "/students/a%26b");
});
