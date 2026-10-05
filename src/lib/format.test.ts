import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatDay,
  formatDayMonth,
  formatMonth,
  formatShortDay,
  formatTime,
  formatTimeRange,
  formatWeekday,
  isDateOnly,
  plural,
  today,
} from "./format";

const NOW = new Date("2026-10-04T12:00:00Z");

test("days read the same way on every screen", () => {
  assert.equal(formatDay("2026-10-04", NOW), "Sunday 4 October");
  assert.equal(formatDay(new Date("2026-10-04T00:00:00Z"), NOW), "Sunday 4 October");
  assert.equal(formatDay("2027-01-01", NOW), "Friday 1 January 2027");
  assert.equal(formatShortDay("2026-10-04"), "Sun 4 Oct");
  assert.equal(formatShortDay("2026-09-27"), "Sun 27 Sep");
  assert.equal(formatWeekday("2026-10-04"), "Sunday");
  assert.equal(formatWeekday("2026-10-04", "short"), "Sun");
  assert.equal(formatDayMonth("2026-09-28"), "28 Sep");
  assert.equal(formatMonth("2026-09-01"), "September 2026");
});

test("September is three letters like every other month", () => {
  assert.equal(formatDate(new Date("2026-09-28T00:00:00Z")), "28 Sep 2026");
  assert.equal(formatDateTime(new Date("2026-09-28T15:00:00Z")), "28 Sep 2026, 16:00");
});

test("ranges join with 'to' and add the year only when needed", () => {
  assert.equal(formatDateRange("2026-09-28", "2026-10-04", NOW), "28 Sep to 4 Oct");
  assert.equal(formatDateRange("2026-12-28", "2027-01-03", NOW), "28 Dec 2026 to 3 Jan 2027");
  assert.equal(formatDateRange("2025-09-01", "2025-09-07", NOW), "1 Sep 2025 to 7 Sep 2025");
  assert.equal(formatTime(990), "16:30");
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTimeRange(990, 1035), "16:30 to 17:15");
});

test("counts agree with their noun", () => {
  assert.equal(plural(1, "swimmer", "swimmers"), "1 swimmer");
  assert.equal(plural(0, "swimmer"), "0 swimmers");
  assert.equal(plural(3, "class", "classes"), "3 classes");
  assert.equal(plural(1204, "swimmer"), "1,204 swimmers");
});

test("calendar validation rejects normalised and malformed dates", () => {
  for (const value of ["2026-02-29", "2026-02-31", "2026-04-31", "2026-13-01", "2026-00-01", "2026-1-01", "", undefined]) assert.equal(isDateOnly(value), false);
  for (const value of ["2024-02-29", "2026-04-30", "2026-12-31"]) assert.equal(isDateOnly(value), true);
});

test("timestamps and the day boundary use the pool's timezone", () => {
  const instant = new Date("2026-07-01T23:30:00.000Z");
  assert.equal(today(instant), "2026-07-02");
  assert.match(formatDateTime(instant), /2 Jul 2026.*00:30/);
});
