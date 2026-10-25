import assert from "node:assert/strict";
import test from "node:test";
import { nextMark, registerCount } from "@/modules/activities/shared/attendance/marking";

test("one tap marks here, a second away, a third late, then round again", () => {
  assert.deepEqual([nextMark(null), nextMark("PRESENT"), nextMark("ABSENT"), nextMark("LATE")], ["PRESENT", "ABSENT", "LATE", "PRESENT"]);
});

test("the register counts late swimmers as here, and unmarked ones as still to mark", () => {
  assert.deepEqual(registerCount(["PRESENT", "LATE", "ABSENT", null, null]), { here: 2, marked: 3, toMark: 2, total: 5 });
  assert.deepEqual(registerCount([]), { here: 0, marked: 0, toMark: 0, total: 0 });
});
