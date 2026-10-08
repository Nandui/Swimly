import assert from "node:assert/strict";
import test from "node:test";
import { MODULE_GROUPS, allModules, groupModules } from "./registry";

test("every module belongs to a known group, and lists show them group by group", () => {
  const keys = MODULE_GROUPS.map((g) => g.key);
  for (const m of allModules()) assert.ok(keys.includes(m.group), `${m.id} has an unknown group: ${m.group}`);
  const ranks = allModules().map((m) => keys.indexOf(m.group));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  assert.deepEqual(groupModules(allModules()).flatMap((g) => g.modules), [...allModules()]);
});

test("the front of house holds the swim school, the academy and refunds", () => {
  const front = groupModules(allModules()).find((g) => g.key === "front-of-house")!;
  assert.deepEqual(front.modules.map((m) => m.id), ["swim-school", "academy", "refunds"]);
  assert.equal(front.label, "Front of house");
});
