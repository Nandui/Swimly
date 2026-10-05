import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingDates, shiftWarnings } from "./constants";
import { dayNeeds, type PlannerShift } from "./planner";

/** Invented people and bookings; the shape the week loads. */
const shift = (id: string, who: string | null, start: number, end: number, extra: Partial<PlannerShift> = {}): PlannerShift => ({
  id, startMinutes: start, endMinutes: end, role: "Poolside", bookingId: null, bookingNeed: null,
  userId: who ? `u-${who}` : null, rotaPersonId: null, user: who ? { name: who } : null, rotaPerson: null, warnings: [], ...extra,
});

test("needs: nobody on a place, someone off or unqualified or double-booked, and cover gaps, in time order", () => {
  const needs = dayNeeds([
    shift("p1", null, 600, 660, { role: "School lessons: St Example", bookingId: "b1", bookingNeed: { role: "Swim teacher" } }),
    shift("s1", "Ava Sample", 420, 900, { warnings: ["absent"] }),
    shift("s2", "Noah Sample", 840, 1020, { warnings: ["missing"] }),
    shift("s3", "Mia Sample", 700, 760, { warnings: ["overlap"] }),
  ], [{ label: "25m pool lifeguard", start: 780, end: 840, short: 1, activityId: "a1" }]);
  assert.deepEqual(needs.map((n) => [n.kind, n.what, n.who]), [
    ["off", "Poolside", "Ava Sample"],
    ["unfilled", "Swim teacher, St Example", null],
    ["double", "Poolside", "Mia Sample"],
    ["cover", "25m pool lifeguard", null],
    ["qualification", "Poolside", "Noah Sample"],
  ]);
});

test("a booking place inside the person's own shift is not double-booking; two places at once are", () => {
  const day = new Date("2026-10-13T00:00:00Z");
  const own = { id: "s", userId: "u", rotaPersonId: null, date: day, startMinutes: 540, endMinutes: 1020, requiredTypeId: null, bookingId: null };
  const place = { ...own, id: "p", startMinutes: 600, endMinutes: 660, bookingId: "b1" };
  const other = { ...own, id: "q", startMinutes: 630, endMinutes: 690, bookingId: "b2" };
  assert.deepEqual(shiftWarnings(place, [], [own, place]), []);
  assert.deepEqual(shiftWarnings(own, [], [own, place]), []);
  assert.deepEqual(shiftWarnings(place, [], [own, place, other]), ["overlap"]);
});

test("a repeating booking leaves out the dates it does not run", () => {
  // Tuesdays from 13 October to 3 November, except mid-term on the 27th.
  assert.deepEqual(bookingDates("2026-10-13", "2026-11-03", [1], ["2026-10-27"]), ["2026-10-13", "2026-10-20", "2026-11-03"]);
});
