import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVITIES_SCREENS, CORE_SCREENS, SCREENS, OTHER_APP_SCREENS, isActivitiesScreen, isCoreScreen } from "./screens";

test("every screen belongs to exactly one of Core, the swim school or another app", () => {
  const areas = [CORE_SCREENS, ACTIVITIES_SCREENS, OTHER_APP_SCREENS].map((list) => new Set<string>(list));
  for (const screen of SCREENS) {
    const owners = areas.filter((area) => area.has(screen.key)).length;
    assert.equal(owners, 1, `${screen.key} must be listed in exactly one area`);
  }
  assert.equal(areas.reduce((n, area) => n + area.size, 0), SCREENS.length);
});

test("Core screens are not Aquatics screens", () => {
  for (const key of CORE_SCREENS) {
    assert.equal(isCoreScreen(key), true);
    assert.equal(isActivitiesScreen(key), false);
  }
  assert.equal(isActivitiesScreen("students"), true);
  assert.equal(isActivitiesScreen("docs"), false);
});

