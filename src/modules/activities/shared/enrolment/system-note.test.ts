import assert from "node:assert/strict";
import { test } from "node:test";
import { SYSTEM_ACTOR_LABEL } from "@/lib/system-actor";
import { systemNote } from "@/modules/activities/shared/enrolment/change";

test("a system account's place change reads as the system, and its confirmation says so", () => {
  assert.equal(SYSTEM_ACTOR_LABEL, "System - scripted action done via development");
  assert.deepEqual(systemNote(false), []);
  assert.deepEqual(systemNote(true), [`Recorded as "${SYSTEM_ACTOR_LABEL}" and left out of analytics.`]);
});
