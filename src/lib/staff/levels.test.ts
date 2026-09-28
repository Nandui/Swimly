import assert from "node:assert/strict";
import test from "node:test";
import { allModules } from "@/modules/registry";
import { ALL_PERMISSIONS, SYSTEM_ROLES, UNRESTRICTED_PERMISSIONS } from "./permissions";
import { ADMINISTRATOR_SCREENS, ALL_SCREENS } from "./screens";
import { WORK_ANYWHERE, accessByReach, cleanLevels, isRestrictedRole, levelsFromAccess, storedAccess } from "./levels";

const owners = (key: string) =>
  allModules().flatMap((m) => [...m.access.levels, ...(m.access.extras ?? [])]
    .filter((step) => (step.permissions as readonly string[]).includes(key) || (step.screens as readonly string[]).includes(key))
    .map((step) => `${m.id}.${step.key}`));

test("every permission and every screen belongs to exactly one level or extra of one module", () => {
  for (const key of ALL_PERMISSIONS.filter((k) => k !== "work.anywhere")) assert.equal(owners(key).length, 1, `${key}: ${owners(key).join(", ") || "no level"}`);
  for (const key of ALL_SCREENS) assert.equal(owners(key).length, 1, `${key}: ${owners(key).join(", ") || "no level"}`);
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

test("levels are cumulative: a higher level gives everything below it", () => {
  const at = (level: string) => storedAccess(cleanLevels({ "swim-school": level }));
  const teach = at("teach"), desk = at("desk"), manage = at("manage");
  for (const key of teach.permissions) assert.ok(desk.permissions.includes(key), key);
  for (const key of desk.permissions) assert.ok(manage.permissions.includes(key), key);
  assert.deepEqual(teach.screens, ["instructor"]);
  assert.ok(!teach.permissions.includes("students.manage"), "teaching never opens the desk");
});

test("Admin Manage is today's administrator: every module except HR", () => {
  const admin = storedAccess(cleanLevels({ admin: "manage" }));
  assert.deepEqual(admin.permissions, [...UNRESTRICTED_PERMISSIONS].sort());
  assert.deepEqual(admin.screens, ADMINISTRATOR_SCREENS);
  assert.equal(isRestrictedRole(cleanLevels({ admin: "manage" })), false);
});

test("HR is restricted, and Their team reaches only the holder's reports", () => {
  const team = cleanLevels({ hr: "team" });
  assert.equal(isRestrictedRole(team), true);
  assert.deepEqual(storedAccess(team).permissions, [], "team HR never lands in the everywhere columns");
  assert.ok(accessByReach(team).team.permissions.includes("hr.records.read"));
  const everyone = storedAccess(cleanLevels({ hr: "all" }));
  assert.ok(everyone.permissions.includes("hr.reviews.write") && everyone.screens.includes("hr"));
});

test("Swim school, Training and Rota apply at the person's sites; the rest everywhere", () => {
  const split = accessByReach(cleanLevels({ "swim-school": "desk", refunds: "use", docs: "read", rota: "view", training: "trainer" }));
  assert.ok(split.sites.permissions.includes("enrolment.manage"));
  assert.ok(split.sites.permissions.includes("rota.view") && split.sites.permissions.includes("training.signoff"));
  assert.ok(split.everywhere.permissions.includes("refunds.request") && split.everywhere.permissions.includes("docs.read"));
});

test("extras need their starting level, and unknown modules or levels are dropped", () => {
  assert.deepEqual(cleanLevels({ docs: "read", nope: "manage", refunds: "boss" }, ["docs.approve", "swim-school.cancel-classes", "x.y"]),
    { levels: { docs: "read" }, extras: ["docs.approve"] });
  assert.deepEqual(cleanLevels({ "swim-school": "teach" }, ["swim-school.cancel-classes"]).extras, [], "cancelling classes starts at Desk");
  assert.ok(storedAccess(cleanLevels({}, [WORK_ANYWHERE])).permissions.includes("work.anywhere"));
});

test("the receptionist from the mockup gets the desk, refunds to log, reading and the rota", () => {
  const receptionist = storedAccess(cleanLevels({ "swim-school": "desk", refunds: "use", docs: "read", rota: "view" }));
  for (const key of ["students.manage", "enrolment.manage", "refunds.request", "docs.read", "rota.view"]) assert.ok(receptionist.permissions.includes(key as never), key);
  for (const key of ["refunds.review", "classes.cancel", "staff.manage", "docs.approve"]) assert.ok(!receptionist.permissions.includes(key as never), key);
  assert.ok(receptionist.screens.includes("refunds") && receptionist.screens.includes("docs") && !receptionist.screens.includes("staff"));
});

test("the shipped roles convert without losing anything; only Viewer gains, and it is reported", () => {
  const byName = Object.fromEntries(SYSTEM_ROLES.map((r) => [r.name, levelsFromAccess(r.permissions, r.screens)]));
  for (const [name, conversion] of Object.entries(byName)) assert.deepEqual(conversion.losses, [], `${name} would lose access`);
  assert.deepEqual(byName.Admin.role.levels, { admin: "manage" });
  assert.deepEqual(byName.Admin.gains, []);
  assert.deepEqual(byName.Instructor.role.levels, { "swim-school": "teach" });
  assert.deepEqual(byName.Instructor.gains, []);
  assert.equal(byName.Viewer.role.levels["swim-school"], "desk");
  assert.ok(byName.Viewer.gains.includes("students.manage"), "Viewer has no read-only level, so its gains are listed for review");
});

test("a legacy role holding HR everywhere converts to HR Everyone, not Their team", () => {
  const hr = levelsFromAccess(["hr.records.read", "hr.notes.write"], ["hr"]);
  assert.deepEqual(hr.role.levels, { hr: "all" });
  assert.deepEqual(hr.losses, []);
  const adminWithHr = levelsFromAccess([...UNRESTRICTED_PERMISSIONS, "hr.records.read"], []);
  assert.deepEqual(adminWithHr.role.levels, { admin: "manage", hr: "all" });
});
