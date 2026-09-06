import assert from "node:assert/strict";
import { test } from "node:test";
import { homePathFor, visibleScreens } from "./screens";
import { expandPermissions } from "./permissions";

test("Reception is a selectable landing page only when the role offers it", () => {
  assert.equal(homePathFor("reception", [], ["reception"]), "/reception");
  assert.equal(homePathFor("reception", [], ["overview"]), "/");
  assert.equal(homePathFor("reception", [], []), "/account");
});

test("Reception screen access does not require or grant enrolment or deck permissions", () => {
  assert.deepEqual([...visibleScreens(["reception", "today"], expandPermissions([]))], ["reception"]);
  assert.equal(visibleScreens(["students", "courses"], expandPermissions(["enrolment.manage"])).has("reception"), false);
});
