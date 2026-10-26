import assert from "node:assert/strict";
import { test } from "node:test";
import { MONITORING_STATUS_META as frontDoorStatuses } from "@/modules/site-monitoring";
import { MONITORING_STATUS_META, MONITORING_STATUSES, readingLine, taskSourceKey } from "./rules";

/** Site Monitoring's pure rules: how a reading reads, and what makes two announcements the same
 *  reading. Raising and closing actions are in __tests__/site-monitoring.test.ts. */
test("a reading reads as name, value and unit, with no stray space when there is no unit", () => {
  assert.equal(readingLine({ reading: "Free chlorine", value: "0.4", unit: "mg/L" }), "Free chlorine 0.4 mg/L");
  assert.equal(readingLine({ reading: "pH", value: "8.1", unit: "" }), "pH 8.1");
});

test("the same reading on the same task is one action; a new value or another task is another", () => {
  const key = taskSourceKey("task-1", "0:chlorine", "0.4");
  assert.equal(key, taskSourceKey("task-1", "0:chlorine", "0.4"));
  assert.notEqual(key, taskSourceKey("task-1", "0:chlorine", "0.5"), "retested and still out of range");
  assert.notEqual(key, taskSourceKey("task-2", "0:chlorine", "0.4"));
  assert.notEqual(key, taskSourceKey("task-1", "1:chlorine", "0.4"), "a second record on the task");
  assert.match(key, /^tasks:/, "says where it came from");
});

test("an action is open, needing action, or closed; the front door shows the same statuses", () => {
  assert.equal(frontDoorStatuses, MONITORING_STATUS_META);
  assert.deepEqual(Object.keys(MONITORING_STATUS_META), [...MONITORING_STATUSES]);
  assert.equal(MONITORING_STATUS_META.open.color, "red");
  assert.equal(MONITORING_STATUS_META.closed.color, "green");
});
