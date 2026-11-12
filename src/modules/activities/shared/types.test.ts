import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVITY_TYPES, activityTypeOf, hasFeature } from "@/modules/activities/shared/types";

test("every programme is Swim school until a type column exists", () => {
  assert.equal(activityTypeOf(undefined).key, "swim-school");
  assert.equal(activityTypeOf({}).name, "Swim school");
  assert.equal(activityTypeOf({ activityType: "not-a-type" }).key, "swim-school");
});

test("Swim school uses progression, assessments, the parent app, waitlists and cover", () => {
  for (const feature of ["progression", "assessments", "parentApp", "waitlists", "cover"] as const) {
    assert.equal(hasFeature(null, feature), true);
  }
  assert.deepEqual(Object.keys(ACTIVITY_TYPES), ["swim-school"]);
});
