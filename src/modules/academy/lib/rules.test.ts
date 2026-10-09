import assert from "node:assert/strict";
import { test } from "node:test";
import { ageOn, bookableOnline, callByFrom, callDue, centsOf, courseState, expiryFrom, paymentFor, readiness } from "./rules";

/** The Academy's rules, on invented candidates. */
const lifeguard = { checks: ["age", "swim", "medical"], minAge: 16, minHours: 36 };
const none = { dateOfBirth: null, swimTestOn: null, medicalOn: null, idCheckedOn: null };

test("a candidate is ready with every check done, old enough on the first day, and their hours", () => {
  const r = readiness(lifeguard, { ...none, dateOfBirth: "2010-03-01", swimTestOn: "2026-10-01", medicalOn: "2026-10-01" }, "2026-10-24", 36 * 60);
  assert.equal(r.ready, true);
  const young = readiness(lifeguard, { ...none, dateOfBirth: "2010-11-01", swimTestOn: "2026-10-01", medicalOn: "2026-10-01" }, "2026-10-24", 36 * 60);
  assert.equal(young.ready, false);
  assert.match(young.checks[0].detail, /15 on the first day; needs 16/);
  assert.equal(readiness(lifeguard, none, "2026-10-24", 0).checks[0].detail, "Date of birth needed");
  assert.equal(readiness(lifeguard, { ...none, dateOfBirth: "2000-01-01", swimTestOn: "x", medicalOn: "x" }, "2026-10-24", 35 * 60).hoursOk, false, "35 of 36 hours");
});

test("a course is running from its first session until it is completed or cancelled", () => {
  assert.equal(courseState({ status: "planned", cancelledAt: null }, "2026-10-24", "2026-10-20"), "planned");
  assert.equal(courseState({ status: "planned", cancelledAt: null }, "2026-10-24", "2026-10-24"), "running");
  assert.equal(courseState({ status: "completed", cancelledAt: null }, "2026-10-24", "2026-11-01"), "completed");
  assert.equal(courseState({ status: "planned", cancelledAt: new Date() }, null, "2026-10-24"), "cancelled");
});

test("a pass expires on the certificate's date, else after the qualification's validity", () => {
  assert.equal(expiryFrom("2026-10-24", "2028-10-31", 24), "2028-10-31");
  assert.equal(expiryFrom("2026-10-24", null, 24), "2028-10-24");
  assert.equal(expiryFrom("2026-10-24", null, null), null);
  assert.equal(ageOn("2010-10-24", "2026-10-24"), 16);
  assert.deepEqual([centsOf("350"), centsOf("€1,250.50"), centsOf("abc")], [35000, 125050, null]);
});

test("a place held online is to be called for within 72 hours, then it is overdue", () => {
  const held = new Date("2026-10-05T11:05:00Z");
  const by = callByFrom(held);
  assert.equal(by.toISOString(), "2026-10-08T11:05:00.000Z");
  assert.deepEqual(callDue(by, new Date("2026-10-05T12:00:00Z")), { due: "later", label: "Thu 8 Oct, 12:05" }, "Dublin time (IST, UTC+1)");
  assert.deepEqual(callDue(by, new Date("2026-10-07T13:00:00Z")), { due: "soon", label: "tomorrow 12:05" });
  assert.deepEqual(callDue(by, new Date("2026-10-08T08:00:00Z")), { due: "soon", label: "today 12:05" });
  assert.deepEqual(callDue(by, new Date("2026-10-08T17:30:00Z")), { due: "overdue", label: "Overdue by 6 h" });
  assert.deepEqual(callDue(by, new Date("2026-10-11T12:00:00Z")), { due: "overdue", label: "Overdue by 3 days" });
});

test("the full price taken by phone is paid, less is a deposit", () => {
  assert.equal(paymentFor(39500, 39500), "paid");
  assert.equal(paymentFor(10000, 39500), "deposit");
  assert.equal(paymentFor(0, 0), "paid", "a free course");
});

test("a course takes online bookings only when put online and before it starts", () => {
  const c = { bookOnline: true, status: "planned", cancelledAt: null };
  assert.equal(bookableOnline(c, "2026-11-07", "2026-10-08"), true);
  assert.equal(bookableOnline({ ...c, bookOnline: false }, "2026-11-07", "2026-10-08"), false);
  assert.equal(bookableOnline(c, "2026-10-08", "2026-10-08"), false, "started today");
  assert.equal(bookableOnline(c, null, "2026-10-08"), false, "no sessions yet");
  assert.equal(bookableOnline({ ...c, cancelledAt: new Date() }, "2026-11-07", "2026-10-08"), false);
});
