import assert from "node:assert/strict";
import { test } from "node:test";
import { callDue, dayWords, holdDeadline, holdSchema, newReference, ONLINE_HOLD_HOURS, whenWords } from "./public-booking";

/** The public booking site's rules: what someone gives to hold a place, the reference they are
 *  given, and when the desk must phone them. Invented people and numbers. */
const hold = (more: object = {}) => holdSchema.parse({ courseId: "course_1", name: "Alex Example", phone: "087 123 4567", ...more });

test("holding a place asks for a name and a phone number the desk can call, and nothing it does not know", () => {
  const h = hold({ name: "  Alex Example  " });
  assert.deepEqual(h, { courseId: "course_1", name: "Alex Example", phone: "087 123 4567", phone2: "", dateOfBirth: "", callTimes: [], note: "", waitingList: false });
  assert.equal(hold({ phone: "+353 (87) 123-4567" }).phone, "+353 (87) 123-4567");
  for (const phone of ["123456", "087 123 4567 ext 2", "+353 87 123 4567 8901", ""]) assert.throws(() => hold({ phone }), /phone number/, phone);
  assert.throws(() => hold({ phone2: "12" }), /phone number/, "a second number, when given, is checked too");
  assert.throws(() => hold({ name: "A" }), /full name/);
  assert.throws(() => hold({ dateOfBirth: "31/12/2010" }), /date of birth/);
  assert.deepEqual(hold({ callTimes: ["morning", "evening"] }).callTimes, ["morning", "evening"]);
  assert.throws(() => hold({ callTimes: ["midnight"] }));
  assert.throws(() => hold({ courseId: "../other" }), "a course id is never a path");
  assert.throws(() => hold({ price: 0 }), "the price is the course's, never the customer's");
  assert.throws(() => hold({ note: "x".repeat(501) }), /under 500/);
});

test("a reference reads clearly over the phone: the kind's prefix and five letters or numbers, never 0, O, 1 or I", () => {
  const refs = Array.from({ length: 200 }, () => newReference("AC"));
  for (const ref of refs) assert.match(ref, /^AC-[A-HJ-NP-Z2-9]{5}$/);
  assert.ok(new Set(refs).size > 190, "references are drawn at random");
});

test("the desk phones within 72 hours of a place being held online", () => {
  assert.equal(ONLINE_HOLD_HOURS, 72);
  assert.equal(holdDeadline(new Date("2026-10-05T11:05:00Z")).toISOString(), "2026-10-08T11:05:00.000Z");
  const by = holdDeadline(new Date("2026-10-23T09:00:00Z"));
  assert.deepEqual(callDue(by, new Date("2026-10-23T10:00:00Z")), { due: "later", label: "Mon 26 Oct, 09:00" }, "Irish winter time from the 25th");
  assert.deepEqual(callDue(by, new Date("2026-10-25T10:00:00Z")), { due: "soon", label: "tomorrow 09:00" });
  assert.deepEqual(callDue(by, new Date("2026-10-26T08:30:00Z")), { due: "soon", label: "today 09:00" });
  assert.deepEqual(callDue(by, new Date("2026-10-26T09:20:00Z")), { due: "overdue", label: "Overdue" });
  assert.deepEqual(callDue(by, new Date("2026-10-26T15:00:00Z")), { due: "overdue", label: "Overdue by 6 h" });
  assert.deepEqual(callDue(by, new Date("2026-10-29T09:00:00Z")), { due: "overdue", label: "Overdue by 3 days" });
});

test("days and times read as the public expect: a course's day as stored, a moment in Dublin time", () => {
  assert.equal(dayWords(new Date("2026-11-07T00:00:00Z")), "Sat 7 Nov");
  assert.equal(whenWords(new Date("2026-11-07T14:05:00Z")), "Sat 7 Nov, 14:05");
  assert.equal(whenWords(new Date("2026-07-04T13:05:00Z")), "Sat 4 Jul, 14:05", "Irish summer time");
});
