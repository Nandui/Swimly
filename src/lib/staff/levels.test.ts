import assert from "node:assert/strict";
import test from "node:test";
import { allModules } from "@/modules/registry";
import { ALL_PERMISSIONS, UNRESTRICTED_PERMISSIONS, expandPermissions } from "./permissions";
import { ADMINISTRATOR_SCREENS, visibleScreens } from "./screens";
import { SYSTEM_ROLES, WORK_ANYWHERE, accessByReach, cleanLevels, describeLevels, isRestrictedRole, levelsFromAccess, roleColumns, storedPermissions } from "./levels";

const owners = (key: string) =>
  allModules().flatMap((m) => [...m.access.levels, ...(m.access.extras ?? [])]
    .filter((step) => (step.permissions as readonly string[]).includes(key))
    .map((step) => `${m.id}.${step.key}`));
const at = (levels: Record<string, string>, extras: string[] = []) => storedPermissions(cleanLevels(levels, extras));
const screensOf = (permissions: readonly string[]) => visibleScreens(expandPermissions(permissions));

test("every permission belongs to exactly one level or extra of one module", () => {
  for (const key of ALL_PERMISSIONS.filter((k) => k !== "work.anywhere")) assert.equal(owners(key).length, 1, `${key}: ${owners(key).join(", ") || "no level"}`);
});

test("every module describes itself: unique ids, levels and a valid starting level for each extra", () => {
  const ids = allModules().map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of allModules()) {
    assert.ok(m.logName, `${m.id} needs a log name`);
    assert.ok(m.access.levels.length > 0, `${m.id} needs a level`);
    const keys = m.access.levels.map((l) => l.key);
    assert.equal(new Set(keys).size, keys.length, `${m.id} repeats a level`);
    for (const extra of m.access.extras ?? []) assert.ok(keys.includes(extra.from), `${m.id}.${extra.key} starts at an unknown level`);
  }
});

test("levels are cumulative, and the desk and the pool deck stay apart", () => {
  const teach = at({ "pool-deck": "teach" }), lead = at({ "pool-deck": "lead" }), desk = at({ "swim-school": "desk" }), manage = at({ "swim-school": "manage" });
  for (const key of teach) assert.ok(lead.includes(key), key);
  for (const key of desk) assert.ok(manage.includes(key), key);
  assert.deepEqual([...screensOf(lead)], ["instructor"], "a lead teacher still sees only the instructor view");
  assert.ok(!screensOf(manage).has("instructor"), "the swim school never opens the pool deck");
});

test("Admin Manage is today's administrator: every module except HR", () => {
  const admin = at({ admin: "manage" });
  assert.deepEqual(admin, [...UNRESTRICTED_PERMISSIONS].sort());
  assert.deepEqual([...screensOf(admin)], ADMINISTRATOR_SCREENS);
  assert.equal(isRestrictedRole(cleanLevels({ admin: "manage" })), false);
});

test("HR is restricted, and Their team reaches only the holder's reports", () => {
  const team = cleanLevels({ hr: "team" });
  assert.equal(isRestrictedRole(team), true);
  assert.deepEqual(storedPermissions(team), [], "team HR never lands in the everywhere columns");
  assert.ok(accessByReach(team).team.includes("hr.records.read"));
  assert.ok(at({ hr: "all" }).includes("hr.reviews.write"));
});

test("Swim school, Pool deck, Training and Rota apply at the person's sites; the rest everywhere", () => {
  const split = accessByReach(cleanLevels({ "swim-school": "desk", "pool-deck": "teach", refunds: "use", docs: "read", rota: "view", training: "trainer" }));
  for (const key of ["enrolment.manage", "attendance.mark", "rota.view", "training.signoff"] as const) assert.ok(split.sites.includes(key), key);
  assert.ok(split.everywhere.includes("refunds.request") && split.everywhere.includes("docs.read"));
});

test("extras need their starting level, and unknown modules or levels are dropped", () => {
  assert.deepEqual(cleanLevels({ docs: "read", nope: "manage", refunds: "boss" }, ["docs.approve", "swim-school.cancel-classes", "x.y"]),
    { levels: { docs: "read" }, extras: ["docs.approve"] });
  assert.deepEqual(cleanLevels({ "pool-deck": "teach" }, ["swim-school.cancel-classes"]).extras, [], "cancelling classes needs the Swim school desk");
  assert.ok(at({}, [WORK_ANYWHERE]).includes("work.anywhere"));
});

test("the receptionist from the mockup gets the desk, refunds to log, reading and the rota", () => {
  const receptionist = at({ "swim-school": "desk", refunds: "use", docs: "read", rota: "view" });
  for (const key of ["swimschool.desk", "students.manage", "enrolment.manage", "refunds.request", "docs.read", "rota.view"]) assert.ok(receptionist.includes(key as never), key);
  for (const key of ["refunds.review", "classes.cancel", "staff.manage", "docs.approve", "attendance.mark"]) assert.ok(!receptionist.includes(key as never), key);
  const screens = screensOf(receptionist);
  assert.ok(screens.has("refunds") && screens.has("docs") && screens.has("students") && !screens.has("staff") && !screens.has("instructor"));
});

test("the built-in roles are valid levels", () => {
  for (const role of SYSTEM_ROLES) assert.deepEqual(cleanLevels(role.levels).levels, role.levels, role.name);
  assert.deepEqual([...screensOf(at(SYSTEM_ROLES.find((r) => r.name === "Instructor")!.levels))], ["instructor"]);
});

test("old roles convert without losing anything, and every gain is reported", () => {
  const instructor = levelsFromAccess(["attendance.mark", "attendance.cover", "progression.complete"], ["instructor"]);
  assert.deepEqual(instructor.role.levels, { "pool-deck": "teach" });
  assert.deepEqual(instructor.losses, []);
  assert.deepEqual(instructor.gains, ["assessments.run"], "assessments are run from the instructor view");
  const viewer = levelsFromAccess([], ["calendar", "students"]);
  assert.deepEqual(viewer.role.levels, { "swim-school": "desk" }, "an old screen counts as the permission its page needs");
  assert.ok(viewer.gains.includes("students.manage"), "there is no read-only level, so the gains are listed for review");
  const admin = levelsFromAccess(["staff.manage", "roles.manage"], []);
  assert.deepEqual(admin.role.levels, { admin: "manage" });
  assert.deepEqual(admin.gains, []);
});

test("a legacy role holding HR everywhere converts to HR Everyone, not Their team", () => {
  const hr = levelsFromAccess(["hr.records.read", "hr.notes.write"], ["hr"]);
  assert.deepEqual(hr.role.levels, { hr: "all" });
  assert.deepEqual(hr.losses, []);
  const adminWithHr = levelsFromAccess([...UNRESTRICTED_PERMISSIONS, "hr.records.read"], []);
  assert.deepEqual(adminWithHr.role.levels, { admin: "manage", hr: "all" });
});

test("a role is described in the owner's words, and its columns match its levels", () => {
  const role = cleanLevels({ "swim-school": "desk", refunds: "use" }, ["swim-school.cancel-classes"]);
  assert.equal(describeLevels(role), "Swim school: Desk (can cancel classes) · Refunds: Use");
  const columns = roleColumns(role);
  assert.equal(columns.restricted, false);
  assert.ok(columns.permissions.includes("classes.cancel") && screensOf(columns.permissions).has("cancellations"));
});

test("an old screen never grants a permission its page already needed", () => {
  // The shipped Viewer stored Staff and Roles screens without their permissions.
  const viewer = levelsFromAccess([], ["students", "staff", "roles", "clubs", "activity", "programmes"]);
  assert.deepEqual(viewer.role.levels, { "swim-school": "desk" });
  assert.ok(!viewer.gains.includes("staff.manage"));
  const duty = levelsFromAccess([], ["duty"]);
  assert.ok(duty.gains.includes("classes.cancel"), "the duty page now needs cancelling, so it is reported");
});
