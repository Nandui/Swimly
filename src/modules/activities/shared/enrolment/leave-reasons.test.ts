import assert from "node:assert/strict";
import { test } from "node:test";
import { changePlace, levelNote } from "./change";
import { isLeaveReason, LEAVE_REASON_CHOICES, LEAVE_REASONS, leaveReasonLabel } from "./leave-reasons";

/** Why a swimmer leaves, and how a move reads on its confirmation. Invented classes. */

test("why a swimmer leaves is one of the stored reasons; an old or unknown one reads as not recorded", () => {
  assert.deepEqual(LEAVE_REASON_CHOICES.map((c) => c.value), Object.keys(LEAVE_REASONS));
  assert.ok(LEAVE_REASON_CHOICES.every((c) => c.label.length > 2));
  assert.equal(isLeaveReason("cost"), true);
  assert.equal(isLeaveReason("other-activity"), true);
  for (const value of ["Cost", "toString", "", null, 3]) assert.equal(isLeaveReason(value), false, String(value));
  assert.equal(leaveReasonLabel("timing"), "Day or time no longer suits");
  assert.equal(leaveReasonLabel("retired-key"), "Not recorded");
  assert.equal(leaveReasonLabel(null), "Not recorded");
});

test("a move's confirmation names the class, its day and times, its level and centre, and says when the level changes", () => {
  const turtles = { name: null, dayOfWeek: "MONDAY" as const, startMinutes: 990, durationMinutes: 30, level: { name: "Turtles" } };
  assert.deepEqual(changePlace(turtles, "Example Leisure Centre"), { title: "Turtles", when: "Monday 16:30 to 17:00", level: "Turtles", centre: "Example Leisure Centre" });
  assert.equal(changePlace({ ...turtles, name: "Adult improvers" }, "Example").title, "Adult improvers");
  assert.deepEqual(levelNote("Turtles", "Penguins"), ["Their level changes from Turtles to Penguins."]);
  assert.deepEqual(levelNote("Turtles", "Turtles"), [], "the same level says nothing");
  assert.deepEqual(levelNote(undefined, "Turtles"), [], "a first place says nothing");
});
