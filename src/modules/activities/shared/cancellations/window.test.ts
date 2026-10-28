import assert from "node:assert/strict";
import { test } from "node:test";
import { cancelWindow, inCancelWindow, undoBlocker } from "@/modules/activities/shared/cancellations/window";

test("the cancel window is today and the next four weeks", () => {
  assert.deepEqual(cancelWindow("2026-10-28"), { from: "2026-10-28", to: "2026-11-25" });
  assert.equal(inCancelWindow("2026-10-28", "2026-10-28"), true);
  assert.equal(inCancelWindow("2026-11-25", "2026-10-28"), true);
  assert.equal(inCancelWindow("2026-11-26", "2026-10-28"), false);
  assert.equal(inCancelWindow("2026-10-27", "2026-10-28"), false);
});

test("undo is offered until billing acts or the class starts", () => {
  const row = { date: new Date("2026-10-28"), startMinutes: 900, attendanceRecorded: 0, billingNotifiedAt: null, legendProcessedAt: null };
  assert.equal(undoBlocker(row, "2026-10-28", 899, false), null);
  assert.match(undoBlocker(row, "2026-10-28", 900, false) ?? "", /start time has passed/);
  assert.match(undoBlocker(row, "2026-10-29", 0, false) ?? "", /start time has passed/);
  assert.equal(undoBlocker({ ...row, date: new Date("2026-11-04") }, "2026-10-28", 1200, false), null);
  assert.match(undoBlocker({ ...row, billingNotifiedAt: new Date() }, "2026-10-28", 0, false) ?? "", /Billing has already acted/);
  assert.match(undoBlocker({ ...row, legendProcessedAt: new Date() }, "2026-10-28", 0, false) ?? "", /Billing has already acted/);
  assert.match(undoBlocker(row, "2026-10-28", 0, true) ?? "", /teacher or attendance/);
  assert.match(undoBlocker({ ...row, attendanceRecorded: 1 }, "2026-10-28", 0, false) ?? "", /teacher or attendance/);
});
