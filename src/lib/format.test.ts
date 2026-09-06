import assert from "node:assert/strict";
import test from "node:test";
import { formatDateTime, isDateOnly, today } from "./format";

test("calendar validation rejects normalised and malformed dates", () => {
  for (const value of ["2026-02-29", "2026-02-31", "2026-04-31", "2026-13-01", "2026-00-01", "2026-1-01", "", undefined]) assert.equal(isDateOnly(value), false);
  for (const value of ["2024-02-29", "2026-04-30", "2026-12-31"]) assert.equal(isDateOnly(value), true);
});

test("timestamps and the day boundary use the pool's timezone", () => {
  const instant = new Date("2026-07-01T23:30:00.000Z");
  assert.equal(today(instant), "2026-07-02");
  assert.match(formatDateTime(instant), /2 Jul 2026.*00:30/);
});
