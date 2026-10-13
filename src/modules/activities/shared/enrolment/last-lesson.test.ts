import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDateOnly } from "@/lib/format";
import { endAfterLesson, lastLessonBefore, lastLessonError, upcomingLessons } from "./last-lesson";

test("upcoming lessons start today on the class day and skip weeks before the place starts", () => {
  assert.deepEqual(upcomingLessons("MONDAY", parseDateOnly("2026-09-01"), "2026-09-07", 3), ["2026-09-07", "2026-09-14", "2026-09-21"]);
  assert.deepEqual(upcomingLessons("SATURDAY", parseDateOnly("2026-10-20"), "2026-10-13", 3), ["2026-10-24", "2026-10-31"]);
});

test("the place ends the day after the last lesson, and reads back as that lesson", () => {
  assert.equal(endAfterLesson("2026-10-31"), "2026-11-01");
  assert.equal(lastLessonBefore("SATURDAY", parseDateOnly("2026-11-01")), "2026-10-31");
});

test("a bare date saved before lessons were chosen reads as the lesson before it", () => {
  // Saturday class, unenrol date picked as Saturday 31 October: that lesson was not theirs.
  assert.equal(lastLessonBefore("SATURDAY", parseDateOnly("2026-10-31")), "2026-10-24");
});

test("only one of the class's lessons from today on can be chosen", () => {
  const started = parseDateOnly("2026-09-01");
  assert.equal(lastLessonError("2026-10-17", { dayOfWeek: "SATURDAY" }, started, "2026-10-13"), null);
  assert.ok(lastLessonError("2026-10-16", { dayOfWeek: "SATURDAY" }, started, "2026-10-13"));
  assert.ok(lastLessonError("2026-10-10", { dayOfWeek: "SATURDAY" }, started, "2026-10-13"));
  assert.ok(lastLessonError("2026-10-17", { dayOfWeek: "SATURDAY" }, parseDateOnly("2026-10-20"), "2026-10-13"));
});
