import assert from "node:assert/strict";
import test from "node:test";
import { CORE_SCREENS, isActivitiesScreen, isCoreScreen } from "./screens";

test("Core screens are not Aquatics screens", () => {
  for (const key of CORE_SCREENS) {
    assert.equal(isCoreScreen(key), true);
    assert.equal(isActivitiesScreen(key), false);
  }
  assert.equal(isActivitiesScreen("students"), true);
  assert.equal(isActivitiesScreen("docs"), false);
});

