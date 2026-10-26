import assert from "node:assert/strict";
import test from "node:test";
import * as frontDoor from "@/modules/short-courses";
import {
  ageOn, appCourseArea, centsOf, clockOf, courseState, inParentsApp, MAX_SESSION_MINUTES, MAX_WEEKS, SHORT_COURSE_AREA_META, SHORT_COURSE_AREAS, SHORT_COURSE_CALL_TIMES, SHORT_COURSE_META,
  SHORT_COURSE_PAYMENT_META, SHORT_COURSE_PAYMENTS, stillOwed, takesPlace, toPhone, waitingOrder, weeklyDates,
} from "./rules";

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

test("the front door's tags are the rules' own, each in its own words, and every state a course reaches has one", () => {
  const metas = Object.entries(frontDoor);
  assert.equal(metas.length, 8);
  for (const [name, meta] of metas) {
    const labels = Object.values(meta).map((t) => t.label);
    assert.equal(new Set(labels).size, labels.length, `${name}: colour is never the only signal`);
    for (const label of labels) assert.ok(label.length > 1, name);
  }
  assert.equal(frontDoor.SHORT_COURSE_META, SHORT_COURSE_META);
  const open = { status: "planned", cancelledAt: null };
  for (const [c, first] of [[open, "2026-11-01"], [open, "2026-10-01"], [{ status: "finished", cancelledAt: null }, null], [{ status: "planned", cancelledAt: new Date() }, null]] as const)
    assert.ok(Object.hasOwn(SHORT_COURSE_META, courseState(c, first, "2026-10-13")));
  assert.deepEqual(SHORT_COURSE_AREAS, Object.keys(SHORT_COURSE_AREA_META));
  assert.deepEqual(SHORT_COURSE_PAYMENTS, Object.keys(SHORT_COURSE_PAYMENT_META));
  assert.deepEqual(Object.keys(SHORT_COURSE_CALL_TIMES), ["morning", "afternoon", "evening"]);
});

test("the desk phones only someone who held a place online, is booked and still owes", () => {
  const held = { source: "online", status: "booked", payment: "owed", callBy: new Date("2026-10-08T11:05:00Z") };
  assert.equal(toPhone(held), true);
  assert.equal(toPhone({ ...held, source: "desk" }), false, "booked at the desk: paid there");
  assert.equal(toPhone({ ...held, status: "waiting" }), false, "no place yet, nothing to pay");
  assert.equal(toPhone({ ...held, payment: "deposit" }), false, "the call already happened");
  assert.equal(toPhone({ ...held, callBy: null }), false);
});

test("the parents app shows only a Pool course Manage put there, still planned and not yet started", () => {
  const c = { bookOnline: true, status: "planned", cancelledAt: null };
  assert.equal(appCourseArea("pool"), true);
  for (const area of ["gym", "studio", "other"]) assert.equal(appCourseArea(area), false, area);
  assert.equal(inParentsApp(c, "pool", "2026-11-01", "2026-10-13"), true);
  assert.equal(inParentsApp(c, "gym", "2026-11-01", "2026-10-13"), false);
  assert.equal(inParentsApp({ ...c, bookOnline: false }, "pool", "2026-11-01", "2026-10-13"), false);
  assert.equal(inParentsApp(c, "pool", "2026-10-13", "2026-10-13"), false, "started today");
  assert.equal(inParentsApp(c, "pool", null, "2026-10-13"), false, "no sessions yet");
  assert.equal(inParentsApp({ ...c, cancelledAt: new Date() }, "pool", "2026-11-01", "2026-10-13"), false);
  assert.equal(inParentsApp({ ...c, status: "finished" }, "pool", "2026-11-01", "2026-10-13"), false);
  assert.equal(MAX_WEEKS, 26, "half a year of weeks at most");
  assert.equal(MAX_SESSION_MINUTES, 240, "four hours a session at most");
});
