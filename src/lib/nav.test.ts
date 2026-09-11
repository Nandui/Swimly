import assert from "node:assert/strict";
import { test } from "node:test";
import { isNavItemActive, swimmerLookupHref, visibleNavGroups } from "./nav";
import { visibleScreens } from "./staff/screens";
import { expandPermissions } from "./staff/permissions";

test("grouping preserves screen and permission restrictions without empty headings", () => {
  const screens = visibleScreens(["today", "roles", "activity"], expandPermissions(["attendance.mark"]));
  const groups = visibleNavGroups(screens);
  assert.deepEqual(groups.map(group => group.label), ["Daily work"]);
  assert.deepEqual(groups.flatMap(group => group.items.map(item => item.href)), ["/today", "/instructor"]);
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
  assert.equal(isNavItemActive("/today", "/"), false);
  assert.equal(isNavItemActive("/", "/"), true);
});

test("swimmer lookup requires the Swimmers screen and never links to retired Reception", () => {
  const retired = visibleScreens(["reception"], expandPermissions([]));
  assert.equal(swimmerLookupHref(retired, "demo"), null);
  assert.deepEqual(visibleNavGroups(retired), []);
  const screens = visibleScreens(["students", "reception", "calendar"], expandPermissions([]));
  assert.deepEqual(visibleNavGroups(screens).flatMap(group => group.items.map(item => item.href)), ["/today", "/students"]);
  assert.equal(swimmerLookupHref(screens, "demo"), "/students/demo");
  assert.equal(swimmerLookupHref(new Set(["instructor"]), "demo"), null);
  assert.equal(swimmerLookupHref(new Set(), "demo"), null);
  assert.equal(swimmerLookupHref(new Set(["students"]), "a&b"), "/students/a%26b");
});
