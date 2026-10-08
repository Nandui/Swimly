import assert from "node:assert/strict";
import { test } from "node:test";
import { ageOn, centsOf, courseState, expiryFrom, readiness } from "./rules";

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
