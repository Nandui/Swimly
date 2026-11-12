import assert from "node:assert/strict";
import { test } from "node:test";
import { ageRangeError, ageRangeLabel } from "@/modules/activities/shared/assessments/age";

const day = new Date("2026-10-10T00:00:00Z");
const swimmer = (dob: string | null) => ({ name: "Test Swimmer", dateOfBirth: dob ? new Date(`${dob}T00:00:00Z`) : null });

test("labels read the way the desk says them", () => {
  assert.equal(ageRangeLabel({ minAge: null, maxAge: null }), null);
  assert.equal(ageRangeLabel({ minAge: 4, maxAge: 8 }), "Ages 4 to 8");
  assert.equal(ageRangeLabel({ minAge: 4, maxAge: 4 }), "Age 4");
  assert.equal(ageRangeLabel({ minAge: 4, maxAge: null }), "Ages 4 and over");
  assert.equal(ageRangeLabel({ minAge: null, maxAge: 8 }), "Up to age 8");
});

test("an open range lets anyone through, with or without a date of birth", () => {
  assert.equal(ageRangeError({ minAge: null, maxAge: null }, swimmer(null), day), null);
  assert.equal(ageRangeError(null, swimmer("2024-01-01"), day), null);
});

test("both ends are included, counted on the session's date", () => {
  const range = { minAge: 4, maxAge: 8 };
  assert.equal(ageRangeError(range, swimmer("2022-10-10"), day), null, "turns 4 on the day");
  assert.match(ageRangeError(range, swimmer("2022-10-11"), day)!, /is 3 on the day/);
  assert.equal(ageRangeError(range, swimmer("2017-10-11"), day), null, "still 8 on the day");
  assert.match(ageRangeError(range, swimmer("2017-10-10"), day)!, /is 9 on the day.*ages 4 to 8/);
});

test("a range with no date of birth to check is refused", () => {
  assert.match(ageRangeError({ minAge: null, maxAge: 8 }, swimmer(null), day)!, /date of birth first.*up to age 8/);
});
