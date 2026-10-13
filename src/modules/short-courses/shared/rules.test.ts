import assert from "node:assert/strict";
import test from "node:test";
import { ageOn, centsOf, clockOf, courseState, stillOwed, takesPlace, waitingOrder, weeklyDates } from "./rules";

test("a course's weekly sessions fall on the same weekday, across the clock change", () => {
  assert.deepEqual(weeklyDates("2026-10-13", 3), ["2026-10-13", "2026-10-20", "2026-10-27"]);
  assert.equal(weeklyDates("2026-10-20", 8).at(-1), "2026-12-08");
});

test("running is worked out from the first day; finished and cancelled are recorded", () => {
  const open = { status: "planned", cancelledAt: null };
  assert.equal(courseState(open, "2026-10-20", "2026-10-13"), "planned");
  assert.equal(courseState(open, "2026-10-13", "2026-10-13"), "running");
  assert.equal(courseState(open, null, "2026-10-13"), "planned");
  assert.equal(courseState({ status: "finished", cancelledAt: null }, "2026-09-01", "2026-10-13"), "finished");
  assert.equal(courseState({ status: "planned", cancelledAt: new Date() }, "2026-09-01", "2026-10-13"), "cancelled");
});

test("only a booking takes a place, and the waiting list is first come, first served", () => {
  assert.equal(takesPlace("booked"), true);
  assert.equal(takesPlace("waiting"), false);
  assert.equal(takesPlace("withdrawn"), false);
  const at = (h: number) => new Date(Date.UTC(2026, 9, 13, h));
  const people = [{ id: "b", status: "waiting", createdAt: at(11) }, { id: "x", status: "booked", createdAt: at(8) }, { id: "a", status: "waiting", createdAt: at(9) }];
  assert.deepEqual(waitingOrder(people).map((p) => p.id), ["a", "b"]);
});

test("money, times and ages", () => {
  assert.equal(centsOf("90"), 9000);
  assert.equal(centsOf("€ 45.50"), 4550);
  assert.equal(centsOf("forty"), null);
  assert.equal(clockOf("18:30"), 1110);
  assert.equal(clockOf("25:00"), null);
  assert.equal(ageOn("2010-10-14", "2026-10-13"), 15);
  assert.equal(ageOn("2010-10-13", "2026-10-13"), 16);
  assert.equal(stillOwed(9000, { payment: "deposit", paidCents: 3000 }), 6000);
  assert.equal(stillOwed(9000, { payment: "paid", paidCents: 0 }), 0);
  assert.equal(stillOwed(9000, { payment: "owed", paidCents: 0 }), 9000);
});
